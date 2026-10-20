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

    public async Task<string?> GetSysConfigValueAsync(string configKey)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<string?>(
            "SELECT configValue FROM SysConfig WHERE configKey = @configKey", new { configKey });
    }
}
