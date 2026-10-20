using System.Data;
using System.Text;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class AppUserRepository(IDbConnectionFactory db) : IAppUserRepository
{
    // PasswordHash / AgentTokenHash are intentionally never selected.
    private const string SelectSql = """
        SELECT u.pkid, u.UserId, u.UserName, u.IsActive, u.PasswordUpdatedTime,
               (SELECT COUNT(*) FROM AppUserRole ur WHERE ur.UserId = u.UserId) AS RoleCount,
               CAST(CASE WHEN u.AgentTokenHash IS NULL THEN 0 ELSE 1 END AS bit) AS HasAgentToken,
               (SELECT COUNT(*) FROM AgentTokenUsage a WHERE a.UserId = u.UserId) AS AgentTokenUsageCount
        FROM AppUser u
        """;

    private const string DefaultOrder = " ORDER BY u.UserId ASC";

    public async Task<IEnumerable<AppUser>> GetAllAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<AppUser>(SelectSql + DefaultOrder);
    }

    public async Task<IEnumerable<AppUser>> QueryAsync(AppUserQuery query)
    {
        var sql = new StringBuilder(SelectSql).Append(" WHERE 1 = 1");
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            sql.Append(" AND (u.UserId LIKE @Keyword OR u.UserName LIKE @Keyword)");
            p.Add("Keyword", $"%{query.Keyword.Trim()}%");
        }
        if (query.IsActive.HasValue)
        {
            sql.Append(" AND u.IsActive = @IsActive");
            p.Add("IsActive", query.IsActive);
        }
        if (!string.IsNullOrWhiteSpace(query.RoleId))
        {
            sql.Append(" AND EXISTS (SELECT 1 FROM AppUserRole ur WHERE ur.UserId = u.UserId AND ur.RoleId = @RoleId)");
            p.Add("RoleId", query.RoleId.Trim());
        }

        sql.Append(DefaultOrder);

        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<AppUser>(sql.ToString(), p);
    }

    public async Task<AppUser?> GetByIdAsync(int pkid)
    {
        using var conn = await db.OpenAsync();
        var user = await conn.QuerySingleOrDefaultAsync<AppUser>(SelectSql + " WHERE u.pkid = @pkid", new { pkid });
        if (user is null) return null;

        // n-n: separate query on same connection
        user.Roles = (await conn.QueryAsync<AppRoleLookup>("""
            SELECT r.pkid, r.RoleId, r.RoleName
            FROM AppUserRole ur
            JOIN AppRole r ON r.RoleId = ur.RoleId
            WHERE ur.UserId = @UserId
            ORDER BY r.RoleId
            """, new { user.UserId })).ToList();

        return user;
    }

    public async Task<bool> UserIdExistsAsync(string userId)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<bool>(
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM AppUser WHERE UserId = @userId) THEN 1 ELSE 0 END",
            new { userId });
    }

    public async Task<IReadOnlyList<string>> CheckRolesAsync(IEnumerable<string> roleIds)
    {
        var ids = roleIds.Where(r => !string.IsNullOrWhiteSpace(r)).Distinct().ToList();
        if (ids.Count == 0) return [];

        using var conn = await db.OpenAsync();
        var existing = (await conn.QueryAsync<string>(
            "SELECT RoleId FROM AppRole WHERE RoleId IN @ids", new { ids })).ToList();
        // RoleId comparison follows the DB's case-insensitive collation.
        return ids.Where(id => !existing.Contains(id, StringComparer.OrdinalIgnoreCase)).ToList();
    }

    public async Task<string?> GetSysConfigValueAsync(string configKey)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<string?>(
            "SELECT configValue FROM SysConfig WHERE configKey = @configKey", new { configKey });
    }

    public async Task<int> CreateAsync(AppUserRequest request, string passwordHash)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var pkid = await conn.ExecuteScalarAsync<int>("""
            INSERT INTO AppUser (UserId, UserName, IsActive, PasswordHash, PasswordUpdatedTime)
            VALUES (@UserId, @UserName, @IsActive, @PasswordHash, NULL);
            SELECT CAST(SCOPE_IDENTITY() AS int);
            """, new { request.UserId, request.UserName, request.IsActive, PasswordHash = passwordHash }, tx);

        await InsertRolesAsync(conn, tx, request.UserId, request.RoleIds);

        tx.Commit();
        return pkid;
    }

    public async Task<bool> UpdateAsync(AppUserRequest request)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        // UserId is the table PK (referenced by AppUserRole) — never changed on update.
        var userId = await conn.ExecuteScalarAsync<string?>(
            "SELECT UserId FROM AppUser WHERE pkid = @Pkid", new { request.Pkid }, tx);
        if (userId is null) return false;

        // PasswordHash / PasswordUpdatedTime are not touched here (see ResetPasswordAsync).
        await conn.ExecuteAsync(
            "UPDATE AppUser SET UserName = @UserName, IsActive = @IsActive WHERE pkid = @Pkid",
            new { request.UserName, request.IsActive, request.Pkid }, tx);

        // n-n: delete-then-reinsert
        await conn.ExecuteAsync("DELETE FROM AppUserRole WHERE UserId = @userId", new { userId }, tx);
        await InsertRolesAsync(conn, tx, userId, request.RoleIds);

        tx.Commit();
        return true;
    }

    public async Task<bool> ResetPasswordAsync(int pkid, string passwordHash, DateTime passwordUpdatedTime)
    {
        using var conn = await db.OpenAsync();
        var rows = await conn.ExecuteAsync(
            "UPDATE AppUser SET PasswordHash = @passwordHash, PasswordUpdatedTime = @passwordUpdatedTime WHERE pkid = @pkid",
            new { pkid, passwordHash, passwordUpdatedTime });
        return rows > 0;
    }

    public async Task<bool> SetAgentTokenHashAsync(int pkid, string? tokenHash)
    {
        using var conn = await db.OpenAsync();
        var rows = await conn.ExecuteAsync(
            "UPDATE AppUser SET AgentTokenHash = @tokenHash WHERE pkid = @pkid", new { pkid, tokenHash });
        return rows > 0;
    }

    public async Task<bool> DeleteAsync(int pkid)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var userId = await conn.ExecuteScalarAsync<string?>(
            "SELECT UserId FROM AppUser WHERE pkid = @pkid", new { pkid }, tx);
        if (userId is null) return false;

        await conn.ExecuteAsync("DELETE FROM AppUserRole WHERE UserId = @userId", new { userId }, tx);
        await conn.ExecuteAsync("DELETE FROM AppUser WHERE pkid = @pkid", new { pkid }, tx);

        tx.Commit();
        return true;
    }

    private static async Task InsertRolesAsync(IDbConnection conn, IDbTransaction tx, string userId, IEnumerable<string> roleIds)
    {
        var rows = roleIds.Where(r => !string.IsNullOrWhiteSpace(r)).Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(roleId => new { UserId = userId, RoleId = roleId })
            .ToList();
        if (rows.Count == 0) return;

        await conn.ExecuteAsync(
            "INSERT INTO AppUserRole (UserId, RoleId) VALUES (@UserId, @RoleId)", rows, tx);
    }
}
