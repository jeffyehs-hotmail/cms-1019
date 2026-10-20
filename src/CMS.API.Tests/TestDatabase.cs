using System.Data;
using System.Security.Claims;
using System.Transactions;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Repositories;
using Dapper;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;

namespace CMS.API.Tests;

/// <summary>
/// The live CMS database, for the few tests that must run real repository SQL (row audit wiring).
/// Every test works inside <see cref="BeginRollback"/>, a TransactionScope that is never completed,
/// so nothing it writes is committed. Override the connection with the CMS_TEST_CONNECTION environment variable.
/// </summary>
public static class TestDatabase
{
    public static readonly string ConnectionString = Environment.GetEnvironmentVariable("CMS_TEST_CONNECTION")
        ?? @"Server=.\SQLEXPRESS;Database=CMS;Trusted_Connection=True;TrustServerCertificate=True;Encrypt=False;Connect Timeout=3";

    private static readonly Lazy<bool> IsAvailable = new(() =>
    {
        try
        {
            using var conn = new SqlConnection(ConnectionString);
            conn.Open();
            return true;
        }
        catch (SqlException)
        {
            return false;
        }
    });

    public static bool Available => IsAvailable.Value;

    public static IDbConnectionFactory Connections { get; } = new SqlConnectionFactory(ConnectionString);

    /// <summary>Ambient transaction for the test; disposing it without Complete() rolls everything back.</summary>
    public static TransactionScope BeginRollback() => new(
        TransactionScopeOption.RequiresNew,
        new TransactionOptions { IsolationLevel = System.Transactions.IsolationLevel.ReadCommitted },
        TransactionScopeAsyncFlowOption.Enabled);

    /// <summary>A RowAuditWriter on the real RowAuditRepository, attributing rows to <paramref name="userName"/>.</summary>
    public static RowAuditWriter Writer(string userName, IRowAuditRepository? repository = null)
    {
        var http = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("name", userName)], "Bearer")),
            },
        };
        return new RowAuditWriter(repository ?? new RowAuditRepository(Connections), http, TimeProvider.System);
    }

    /// <summary>RowAudit rows of one table row, oldest first.</summary>
    public static async Task<List<RowAudit>> AuditsAsync(string tableName, object pkid)
    {
        using var conn = await Connections.OpenAsync();
        return (await conn.QueryAsync<RowAudit>("""
            SELECT TableName, UserName, PrimaryKeyValues, ActionType, ActionDesc, [DateTime]
            FROM RowAudit WHERE TableName = @tableName AND PrimaryKeyValues = @pk ORDER BY pkid
            """, new { tableName, pk = Convert.ToString(pkid, System.Globalization.CultureInfo.InvariantCulture) })).ToList();
    }
}

/// <summary>Database test classes run one at a time: parallel rolled-back transactions deadlock on RowAudit scans.</summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class DatabaseCollection
{
    public const string Name = "Database";
}

/// <summary>A [Fact] that is skipped (with a reason) when the CMS database cannot be reached.</summary>
public sealed class DatabaseFactAttribute : FactAttribute
{
    public DatabaseFactAttribute()
    {
        if (!TestDatabase.Available) Skip = $"CMS database not reachable ({TestDatabase.ConnectionString}); set CMS_TEST_CONNECTION.";
    }
}

/// <summary>IRowAuditRepository whose insert always fails, to prove the audited change rolls back with it.</summary>
public sealed class FailingRowAuditRepository : IRowAuditRepository
{
    public Task InsertAsync(RowAudit audit, IDbTransaction? tx = null)
        => throw new InvalidOperationException("audit insert failed");

    public Task<IEnumerable<RowAuditEntry>> GetByRecordAsync(string tableName, string primaryKeyValues)
        => Task.FromResult(Enumerable.Empty<RowAuditEntry>());
}
