using System.Data;
using System.Text;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class AppRoleRepository(IDbConnectionFactory db, RowAuditWriter audit) : IAppRoleRepository
{
    private const string Table = "AppRole";

    private const string SelectSql = """
        SELECT r.pkid, r.RoleId, r.RoleName, r.PermissionLevel, r.Description,
               (SELECT COUNT(*) FROM AppUserRole ur WHERE ur.RoleId = r.RoleId) AS UserCount
        FROM AppRole r
        """;

    private const string DefaultOrder = " ORDER BY r.RoleId ASC";

    public async Task<IEnumerable<AppRole>> GetAllAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<AppRole>(SelectSql + DefaultOrder);
    }

    public async Task<IEnumerable<AppRole>> QueryAsync(AppRoleQuery query)
    {
        var sql = new StringBuilder(SelectSql).Append(" WHERE 1 = 1");
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            sql.Append(" AND (r.RoleId LIKE @Keyword OR r.RoleName LIKE @Keyword OR r.Description LIKE @Keyword)");
            p.Add("Keyword", $"%{query.Keyword.Trim()}%");
        }
        if (query.PermissionLevelFrom.HasValue)
        {
            sql.Append(" AND r.PermissionLevel >= @PermissionLevelFrom");
            p.Add("PermissionLevelFrom", query.PermissionLevelFrom);
        }
        if (query.PermissionLevelTo.HasValue)
        {
            sql.Append(" AND r.PermissionLevel <= @PermissionLevelTo");
            p.Add("PermissionLevelTo", query.PermissionLevelTo);
        }

        sql.Append(DefaultOrder);

        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<AppRole>(sql.ToString(), p);
    }

    public async Task<AppRole?> GetByIdAsync(int pkid)
    {
        using var conn = await db.OpenAsync();
        var role = await conn.QuerySingleOrDefaultAsync<AppRole>(SelectSql + " WHERE r.pkid = @pkid", new { pkid });
        if (role is null) return null;

        // n-n: separate query on same connection
        role.Users = (await conn.QueryAsync<AppUserLookup>("""
            SELECT u.pkid, u.UserId, u.UserName
            FROM AppUserRole ur
            JOIN AppUser u ON u.UserId = ur.UserId
            WHERE ur.RoleId = @RoleId
            ORDER BY u.UserName
            """, new { role.RoleId })).ToList();

        return role;
    }

    public async Task<bool> RoleIdExistsAsync(string roleId)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<bool>(
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM AppRole WHERE RoleId = @roleId) THEN 1 ELSE 0 END",
            new { roleId });
    }

    public async Task<int> CreateAsync(AppRoleRequest request)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var pkid = await conn.ExecuteScalarAsync<int>("""
            INSERT INTO AppRole (RoleId, RoleName, PermissionLevel, Description)
            VALUES (@RoleId, @RoleName, @PermissionLevel, @Description);
            SELECT CAST(SCOPE_IDENTITY() AS int);
            """, request, tx);

        await InsertUsersAsync(conn, tx, request.RoleId, request.UserIds);

        await audit.LogInsertAsync(Table, (await RowAuditWriter.LoadRowAsync(tx, Table, pkid))!, tx);
        tx.Commit();
        return pkid;
    }

    public async Task<bool> UpdateAsync(AppRoleRequest request)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        // RoleId is the table PK (referenced by AppUserRole) — never changed on update.
        var before = await RowAuditWriter.LoadRowAsync(tx, Table, request.Pkid);
        if (before is null) return false;
        var roleId = (string)before["RoleId"]!;

        await conn.ExecuteAsync("""
            UPDATE AppRole
            SET RoleName = @RoleName, PermissionLevel = @PermissionLevel, Description = @Description
            WHERE pkid = @Pkid
            """, request, tx);

        // n-n: delete-then-reinsert
        await conn.ExecuteAsync("DELETE FROM AppUserRole WHERE RoleId = @roleId", new { roleId }, tx);
        await InsertUsersAsync(conn, tx, roleId, request.UserIds);

        await audit.LogUpdateAsync(Table, before, (await RowAuditWriter.LoadRowAsync(tx, Table, request.Pkid))!, tx);
        tx.Commit();
        return true;
    }

    public async Task<bool> DeleteAsync(int pkid)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var row = await RowAuditWriter.LoadRowAsync(tx, Table, pkid);
        if (row is null) return false;
        var roleId = (string)row["RoleId"]!;

        await conn.ExecuteAsync("DELETE FROM AppUserRole WHERE RoleId = @roleId", new { roleId }, tx);
        await conn.ExecuteAsync("DELETE FROM AppRole WHERE pkid = @pkid", new { pkid }, tx);

        await audit.LogDeleteAsync(Table, row, tx);
        tx.Commit();
        return true;
    }

    private static async Task InsertUsersAsync(IDbConnection conn, IDbTransaction tx, string roleId, IEnumerable<string> userIds)
    {
        var rows = userIds.Where(u => !string.IsNullOrWhiteSpace(u)).Distinct()
            .Select(userId => new { UserId = userId, RoleId = roleId })
            .ToList();
        if (rows.Count == 0) return;

        await conn.ExecuteAsync(
            "INSERT INTO AppUserRole (UserId, RoleId) VALUES (@UserId, @RoleId)", rows, tx);
    }
}
