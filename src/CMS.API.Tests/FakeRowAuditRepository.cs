using System.Data;
using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests;

/// <summary>In-memory IRowAuditRepository: keeps every inserted row for assertions.</summary>
public class FakeRowAuditRepository : IRowAuditRepository
{
    private readonly object _lock = new();
    private readonly List<RowAudit> _rows = [];

    public IReadOnlyList<RowAudit> Rows
    {
        get { lock (_lock) return _rows.ToList(); }
    }

    public Task InsertAsync(RowAudit audit, IDbTransaction? tx = null)
    {
        lock (_lock) _rows.Add(audit);
        return Task.CompletedTask;
    }

    /// <summary>Like the SQL: exact match (the column collation is case-insensitive), newest first, later insert first on ties.</summary>
    public Task<IEnumerable<RowAuditEntry>> GetByRecordAsync(string tableName, string primaryKeyValues)
    {
        lock (_lock)
        {
            IEnumerable<RowAuditEntry> rows = _rows
                .Select((r, i) => (Row: r, Index: i))
                .Where(x => x.Row.TableName.Equals(tableName, StringComparison.OrdinalIgnoreCase)
                    && x.Row.PrimaryKeyValues.Equals(primaryKeyValues, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(x => x.Row.DateTime).ThenByDescending(x => x.Index)
                .Select(x => new RowAuditEntry
                {
                    DateTime = x.Row.DateTime, UserName = x.Row.UserName, ActionType = x.Row.ActionType, ActionDesc = x.Row.ActionDesc,
                })
                .ToList();
            return Task.FromResult(rows);
        }
    }
}
