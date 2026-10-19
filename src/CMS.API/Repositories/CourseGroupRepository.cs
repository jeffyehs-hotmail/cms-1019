using System.Text;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class CourseGroupRepository(IDbConnectionFactory db) : ICourseGroupRepository
{
    private const string SelectSql = """
        SELECT g.pkid, g.Description,
               (SELECT COUNT(*) FROM Course c WHERE c.CourseGroup_pkid = g.pkid) AS CourseCount,
               (SELECT COUNT(*) FROM PartnerCourseGroup pg WHERE pg.CourseGroup_pkid = g.pkid) AS PartnerCourseGroupCount
        FROM CourseGroup g
        """;

    private const string DefaultOrder = " ORDER BY g.pkid DESC";

    public async Task<IEnumerable<CourseGroup>> GetAllAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<CourseGroup>(SelectSql + DefaultOrder);
    }

    public async Task<IEnumerable<CourseGroup>> QueryAsync(CourseGroupQuery query)
    {
        var sql = new StringBuilder(SelectSql).Append(" WHERE 1 = 1");
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            sql.Append(" AND g.Description LIKE @Keyword");
            p.Add("Keyword", $"%{query.Keyword.Trim()}%");
        }

        sql.Append(DefaultOrder);

        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<CourseGroup>(sql.ToString(), p);
    }

    public async Task<CourseGroup?> GetByIdAsync(short pkid)
    {
        using var conn = await db.OpenAsync();
        return await conn.QuerySingleOrDefaultAsync<CourseGroup>(SelectSql + " WHERE g.pkid = @pkid", new { pkid });
    }

    public async Task<short> CreateAsync(CourseGroupRequest request)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<short>("""
            INSERT INTO CourseGroup (Description) VALUES (@Description);
            SELECT CAST(SCOPE_IDENTITY() AS smallint);
            """, request);
    }

    public async Task<bool> UpdateAsync(CourseGroupRequest request)
    {
        using var conn = await db.OpenAsync();
        var rows = await conn.ExecuteAsync(
            "UPDATE CourseGroup SET Description = @Description WHERE pkid = @Pkid", request);
        return rows > 0;
    }

    public async Task<bool> DeleteAsync(short pkid)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteAsync("DELETE FROM CourseGroup WHERE pkid = @pkid", new { pkid }) > 0;
    }
}
