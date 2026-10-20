using System.Data;
using System.Text;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class PartnerRepository(IDbConnectionFactory db, RowAuditWriter audit) : IPartnerRepository
{
    private const string Table = "Partner";

    private const string SelectSql = """
        SELECT p.pkid, p.Name, p.AppKey, p.NameOnPartnerMenu, p.NameOnCourseDetailPage, p.DisplayOrder, p.ImageFilename,
               (SELECT COUNT(*) FROM Course c WHERE c.Partner_pkid = p.pkid) AS CourseCount,
               (SELECT COUNT(*) FROM Certification ce WHERE ce.Partner_pkid = p.pkid) AS CertificationCount,
               (SELECT COUNT(*) FROM PartnerCourseGroup g WHERE g.Partner_pkid = p.pkid) AS PartnerCourseGroupCount,
               (SELECT COUNT(*) FROM Promotion2 pr WHERE pr.RelatedPartner_pkid = p.pkid) AS Promotion2Count,
               (SELECT COUNT(*) FROM Seminar s WHERE s.Partner_pkid = p.pkid) AS SeminarCount
        FROM Partner p
        """;

    private const string DefaultOrder = " ORDER BY p.DisplayOrder ASC, p.pkid DESC";

    public async Task<IEnumerable<Partner>> GetAllAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<Partner>(SelectSql + DefaultOrder);
    }

    public async Task<IEnumerable<Partner>> QueryAsync(PartnerQuery query)
    {
        var sql = new StringBuilder(SelectSql).Append(" WHERE 1 = 1");
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            sql.Append(" AND (p.Name LIKE @Keyword OR p.AppKey LIKE @Keyword OR p.NameOnPartnerMenu LIKE @Keyword")
               .Append(" OR p.NameOnCourseDetailPage LIKE @Keyword OR p.ImageFilename LIKE @Keyword)");
            p.Add("Keyword", $"%{query.Keyword.Trim()}%");
        }

        sql.Append(DefaultOrder);

        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<Partner>(sql.ToString(), p);
    }

    public async Task<Partner?> GetByIdAsync(short pkid)
    {
        using var conn = await db.OpenAsync();
        return await conn.QuerySingleOrDefaultAsync<Partner>(SelectSql + " WHERE p.pkid = @pkid", new { pkid });
    }

    public async Task<bool> AppKeyExistsAsync(string appKey, short excludePkid = 0)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<bool>(
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM Partner WHERE AppKey = @appKey AND pkid <> @excludePkid) THEN 1 ELSE 0 END",
            new { appKey = new DbString { Value = appKey, IsAnsi = true, Length = 10 }, excludePkid });
    }

    public async Task<short> CreateAsync(PartnerRequest request)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var pkid = await conn.ExecuteScalarAsync<short>("""
            INSERT INTO Partner (Name, AppKey, NameOnPartnerMenu, NameOnCourseDetailPage, DisplayOrder, ImageFilename)
            VALUES (@Name, @AppKey, @NameOnPartnerMenu, @NameOnCourseDetailPage, @DisplayOrder, @ImageFilename);
            SELECT CAST(SCOPE_IDENTITY() AS smallint);
            """, ToParams(request), tx);

        await audit.LogInsertAsync(Table, (await RowAuditWriter.LoadRowAsync(tx, Table, pkid))!, tx);
        tx.Commit();
        return pkid;
    }

    public async Task<bool> UpdateAsync(PartnerRequest request)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var before = await RowAuditWriter.LoadRowAsync(tx, Table, request.Pkid);
        if (before is null) return false;

        await conn.ExecuteAsync("""
            UPDATE Partner
            SET Name = @Name, AppKey = @AppKey, NameOnPartnerMenu = @NameOnPartnerMenu,
                NameOnCourseDetailPage = @NameOnCourseDetailPage, DisplayOrder = @DisplayOrder, ImageFilename = @ImageFilename
            WHERE pkid = @Pkid
            """, ToParams(request), tx);

        await audit.LogUpdateAsync(Table, before, (await RowAuditWriter.LoadRowAsync(tx, Table, request.Pkid))!, tx);
        tx.Commit();
        return true;
    }

    public async Task<bool> DeleteAsync(short pkid)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var row = await RowAuditWriter.LoadRowAsync(tx, Table, pkid);
        if (row is null) return false;

        await conn.ExecuteAsync("DELETE FROM Partner WHERE pkid = @pkid", new { pkid }, tx);

        await audit.LogDeleteAsync(Table, row, tx);
        tx.Commit();
        return true;
    }

    // AppKey / ImageFilename are varchar — send them as AnsiString rather than nvarchar.
    private static DynamicParameters ToParams(PartnerRequest r)
    {
        var p = new DynamicParameters(r);
        p.Add("AppKey", r.AppKey, DbType.AnsiString, size: 10);
        p.Add("ImageFilename", r.ImageFilename, DbType.AnsiString, size: 50);
        return p;
    }
}
