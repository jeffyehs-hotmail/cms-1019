using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IAuthRepository
{
    /// <summary>The AppUser row (with PasswordHash) for the UserId, or null.</summary>
    Task<LoginUser?> GetLoginUserAsync(string userId);

    /// <summary>RoleId values in AppUserRole for the user.</summary>
    Task<IReadOnlyList<string>> GetRoleIdsAsync(string userId);

    /// <summary>The user's own profile with role names, or null if the AppUser row is gone.</summary>
    Task<UserProfile?> GetProfileAsync(string userId);

    /// <summary>Sets AppUser.UserName for the UserId; false if no row matched.</summary>
    Task<bool> UpdateUserNameAsync(string userId, string userName);

    /// <summary>Sets AppUser.PasswordHash and PasswordUpdatedTime for the UserId; false if no row matched.</summary>
    Task<bool> UpdatePasswordAsync(string userId, string passwordHash, DateTime passwordUpdatedTime);

    /// <summary>Raw SysConfig.configValue for the key, or null.</summary>
    Task<string?> GetSysConfigValueAsync(string configKey);
}
