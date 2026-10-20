using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IAppUserRepository
{
    Task<IEnumerable<AppUser>> GetAllAsync();
    Task<IEnumerable<AppUser>> QueryAsync(AppUserQuery query);
    Task<AppUser?> GetByIdAsync(int pkid);
    Task<bool> UserIdExistsAsync(string userId);

    /// <summary>Role ids from the list that don't exist in AppRole.</summary>
    Task<IReadOnlyList<string>> CheckRolesAsync(IEnumerable<string> roleIds);

    /// <summary>Raw SysConfig.configValue for the key, or null.</summary>
    Task<string?> GetSysConfigValueAsync(string configKey);

    Task<int> CreateAsync(AppUserRequest request, string passwordHash);
    Task<bool> UpdateAsync(AppUserRequest request);
    Task<bool> ResetPasswordAsync(int pkid, string passwordHash);

    /// <summary>Sets AppUser.AgentTokenHash (null = revoke).</summary>
    Task<bool> SetAgentTokenHashAsync(int pkid, string? tokenHash);

    Task<bool> DeleteAsync(int pkid);
}
