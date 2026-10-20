using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IAuthRepository
{
    /// <summary>The AppUser row (with PasswordHash) for the UserId, or null.</summary>
    Task<LoginUser?> GetLoginUserAsync(string userId);

    /// <summary>RoleId values in AppUserRole for the user.</summary>
    Task<IReadOnlyList<string>> GetRoleIdsAsync(string userId);

    /// <summary>Raw SysConfig.configValue for the key, or null.</summary>
    Task<string?> GetSysConfigValueAsync(string configKey);
}
