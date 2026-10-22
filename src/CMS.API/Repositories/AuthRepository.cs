using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class AuthRepository(IDbConnectionFactory db, RowAuditWriter audit) : IAuthRepository
{
    private const string Table = "AppUser";

    public async Task<LoginUser?> GetLoginUserAsync(string userId)
    {
        using var conn = await db.OpenAsync();
        return await conn.QuerySingleOrDefaultAsync<LoginUser>(
            "SELECT UserId, UserName, IsActive, PasswordHash FROM AppUser WHERE UserId = @userId",
            new { userId });
    }

    public async Task<IReadOnlyList<string>> GetRoleIdsAsync(string userId)
    {
        using var conn = await db.OpenAsync();
        return (await conn.QueryAsync<string>(
            "SELECT RoleId FROM AppUserRole WHERE UserId = @userId ORDER BY RoleId", new { userId })).ToList();
    }

    public async Task<UserProfile?> GetProfileAsync(string userId)
    {
        using var conn = await db.OpenAsync();
        var profile = await conn.QuerySingleOrDefaultAsync<UserProfile>(
            "SELECT UserId, UserName FROM AppUser WHERE UserId = @userId", new { userId });
        if (profile is null) return null;

        profile.Roles = (await conn.QueryAsync<AppRoleLookup>("""
            SELECT r.pkid, r.RoleId, r.RoleName
            FROM AppUserRole ur
            JOIN AppRole r ON r.RoleId = ur.RoleId
            WHERE ur.UserId = @userId
            ORDER BY r.RoleId
            """, new { userId })).ToList();
        return profile;
    }

    public Task<bool> UpdateUserNameAsync(string userId, string userName)
        => UpdateAuditedAsync(userId,
            "UPDATE AppUser SET UserName = @userName WHERE UserId = @userId", new { userId, userName });

    public Task<bool> UpdatePasswordAsync(string userId, string passwordHash, DateTime passwordUpdatedTime)
        => UpdateAuditedAsync(userId,
            "UPDATE AppUser SET PasswordHash = @passwordHash, PasswordUpdatedTime = @passwordUpdatedTime WHERE UserId = @userId",
            new { userId, passwordHash, passwordUpdatedTime });

    public async Task<string?> GetSysConfigValueAsync(string configKey)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<string?>(
            "SELECT configValue FROM SysConfig WHERE configKey = @configKey", new { configKey });
    }

    /// <summary>Runs one UPDATE of the user's AppUser row and audits it, in one transaction; false if no row matched.</summary>
    private async Task<bool> UpdateAuditedAsync(string userId, string sql, object param)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var before = await RowAuditWriter.LoadRowAsync(tx, Table, userId, "UserId");
        if (before is null) return false;

        await conn.ExecuteAsync(sql, param, tx);

        await audit.LogUpdateAsync(Table, before, (await RowAuditWriter.LoadRowAsync(tx, Table, userId, "UserId"))!, tx);
        tx.Commit();
        return true;
    }
}
