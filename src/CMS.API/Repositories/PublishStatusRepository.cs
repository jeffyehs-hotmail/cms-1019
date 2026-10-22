using System.Text;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class PublishStatusRepository(IDbConnectionFactory db, RowAuditWriter audit) : IPublishStatusRepository
{
    private const string Table = "PublishStatus";

    private const string SelectSql = """
        SELECT s.pkid, s.Description, s.IsDraft, s.IsPublished, s.IsDiscontinued,
               (SELECT COUNT(*) FROM Course c WHERE c.PublishStatus_pkid = s.pkid) AS CourseCount,
               (SELECT COUNT(*) FROM Promotion2 p WHERE p.PublishStatus_pkid = s.pkid) AS Promotion2Count
        FROM PublishStatus s
        """;

    private const string DefaultOrder = " ORDER BY s.pkid ASC";

    public async Task<IEnumerable<PublishStatus>> GetAllAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<PublishStatus>(SelectSql + DefaultOrder);
    }

    public async Task<IEnumerable<PublishStatus>> QueryAsync(PublishStatusQuery query)
    {
        var sql = new StringBuilder(SelectSql).Append(" WHERE 1 = 1");
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            sql.Append(" AND s.Description LIKE @Keyword");
            p.Add("Keyword", $"%{query.Keyword.Trim()}%");
        }
        if (query.IsDraft.HasValue)
        {
            sql.Append(" AND s.IsDraft = @IsDraft");
            p.Add("IsDraft", query.IsDraft);
        }
        if (query.IsPublished.HasValue)
        {
            sql.Append(" AND s.IsPublished = @IsPublished");
            p.Add("IsPublished", query.IsPublished);
        }
        if (query.IsDiscontinued.HasValue)
        {
            sql.Append(" AND s.IsDiscontinued = @IsDiscontinued");
            p.Add("IsDiscontinued", query.IsDiscontinued);
        }

        sql.Append(DefaultOrder);

        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<PublishStatus>(sql.ToString(), p);
    }

    public async Task<PublishStatus?> GetByIdAsync(byte pkid)
    {
        using var conn = await db.OpenAsync();
        return await conn.QuerySingleOrDefaultAsync<PublishStatus>(SelectSql + " WHERE s.pkid = @pkid", new { pkid });
    }

    public async Task<bool> ExistsAsync(byte pkid)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<bool>(
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM PublishStatus WHERE pkid = @pkid) THEN 1 ELSE 0 END",
            new { pkid });
    }

    public async Task CreateAsync(PublishStatusRequest request)
    {
        // pkid is not IDENTITY — inserted as supplied.
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        await conn.ExecuteAsync("""
            INSERT INTO PublishStatus (pkid, Description, IsDraft, IsPublished, IsDiscontinued)
            VALUES (@Pkid, @Description, @IsDraft, @IsPublished, @IsDiscontinued)
            """, request, tx);

        await audit.LogInsertAsync(Table, (await RowAuditWriter.LoadRowAsync(tx, Table, request.Pkid))!, tx);
        tx.Commit();
    }

    public async Task<bool> UpdateAsync(PublishStatusRequest request)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var before = await RowAuditWriter.LoadRowAsync(tx, Table, request.Pkid);
        if (before is null) return false;

        await conn.ExecuteAsync("""
            UPDATE PublishStatus
            SET Description = @Description, IsDraft = @IsDraft, IsPublished = @IsPublished, IsDiscontinued = @IsDiscontinued
            WHERE pkid = @Pkid
            """, request, tx);

        await audit.LogUpdateAsync(Table, before, (await RowAuditWriter.LoadRowAsync(tx, Table, request.Pkid))!, tx);
        tx.Commit();
        return true;
    }

    public async Task<bool> DeleteAsync(byte pkid)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var row = await RowAuditWriter.LoadRowAsync(tx, Table, pkid);
        if (row is null) return false;

        await conn.ExecuteAsync("DELETE FROM PublishStatus WHERE pkid = @pkid", new { pkid }, tx);

        await audit.LogDeleteAsync(Table, row, tx);
        tx.Commit();
        return true;
    }
}
