using System.Data;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class RowAuditRepository(IDbConnectionFactory db) : IRowAuditRepository
{
    public async Task InsertAsync(RowAudit audit, IDbTransaction? tx = null)
    {
        var p = new DynamicParameters();
        p.Add("TableName", audit.TableName, DbType.AnsiString);
        p.Add("UserName", audit.UserName);
        p.Add("PrimaryKeyValues", audit.PrimaryKeyValues);
        p.Add("ActionType", audit.ActionType, DbType.AnsiString);
        // Sent as nvarchar so SQL Server converts Chinese text to the column's code page (950) itself.
        p.Add("ActionDesc", audit.ActionDesc);
        p.Add("DateTime", audit.DateTime, DbType.DateTime);

        const string sql = """
            INSERT INTO RowAudit (TableName, UserName, PrimaryKeyValues, ActionType, ActionDesc, [DateTime])
            VALUES (@TableName, @UserName, @PrimaryKeyValues, @ActionType, @ActionDesc, @DateTime);
            """;

        // Same transaction as the audited change, so a rolled-back change leaves no audit row.
        if (tx is not null)
        {
            await tx.Connection!.ExecuteAsync(sql, p, tx);
            return;
        }

        using var conn = await db.OpenAsync();
        await conn.ExecuteAsync(sql, p);
    }

    public async Task<IEnumerable<RowAuditEntry>> GetByRecordAsync(string tableName, string primaryKeyValues)
    {
        var p = new DynamicParameters();
        p.Add("TableName", tableName, DbType.AnsiString, size: 50);
        p.Add("PrimaryKeyValues", primaryKeyValues, size: 100);

        // pkid breaks ties between rows written within the same datetime tick (3.33 ms).
        const string sql = """
            SELECT [DateTime], UserName, ActionType, ActionDesc
            FROM RowAudit
            WHERE TableName = @TableName AND PrimaryKeyValues = @PrimaryKeyValues
            ORDER BY [DateTime] DESC, pkid DESC;
            """;

        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<RowAuditEntry>(sql, p);
    }
}
