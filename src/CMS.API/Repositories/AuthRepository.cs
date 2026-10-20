using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class AuthRepository(IDbConnectionFactory db) : IAuthRepository
{
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

    public async Task<bool> UpdateUserNameAsync(string userId, string userName)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteAsync(
            "UPDATE AppUser SET UserName = @userName WHERE UserId = @userId", new { userId, userName }) > 0;
    }

    public async Task<bool> UpdatePasswordAsync(string userId, string passwordHash, DateTime passwordUpdatedTime)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteAsync(
            "UPDATE AppUser SET PasswordHash = @passwordHash, PasswordUpdatedTime = @passwordUpdatedTime WHERE UserId = @userId",
            new { userId, passwordHash, passwordUpdatedTime }) > 0;
    }

    public async Task<string?> GetSysConfigValueAsync(string configKey)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<string?>(
            "SELECT configValue FROM SysConfig WHERE configKey = @configKey", new { configKey });
    }
}
