using System.Data;
using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IRowAuditRepository
{
    /// <summary>Inserts the row on <paramref name="tx"/>'s connection and transaction, or on a connection of its own when null.</summary>
    Task InsertAsync(RowAudit audit, IDbTransaction? tx = null);

    /// <summary>The RowAudit rows of one table row (TableName + PrimaryKeyValues), newest first.</summary>
    Task<IEnumerable<RowAuditEntry>> GetByRecordAsync(string tableName, string primaryKeyValues);
}
