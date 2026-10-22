using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Security;

namespace CMS.API.Tests;

/// <summary>In-memory IAuthRepository: a few AppUser rows with real SHA-256 hashes, their roles, and SysConfig.</summary>
public class FakeAuthRepository : IAuthRepository
{
    public const string Password = "P@ssw0rd!";
    public const string SigningKey = "test-signing-key-0123456789abcdef"; // 33 bytes, HS256 needs >= 32

    private readonly List<LoginUser> _users =
    [
        new() { UserId = "alice", UserName = "Alice", IsActive = true, PasswordHash = PasswordHasher.Hash(Password) },
        new() { UserId = "bob", UserName = "Bob", IsActive = false, PasswordHash = PasswordHasher.Hash(Password) },
        new() { UserId = "carol", UserName = "Carol", IsActive = true, PasswordHash = PasswordHasher.Hash(Password) },
    ];

    private readonly Dictionary<string, List<string>> _roles = new(StringComparer.OrdinalIgnoreCase)
    {
        ["alice"] = ["Admin", "User"],
        ["bob"] = ["User"],
    };

    /// <summary>SysConfig 'appConfig' value; tests may replace it (null = row missing).</summary>
    public string? AppConfigValue { get; set; } =
        $$"""{ "defaultPassword": "x", "symmetricSecurityKey": "{{SigningKey}}", "enforcePasswordPolicy": true }""";

    /// <summary>AppUser.PasswordUpdatedTime per UserId (NULL until changed), set by UpdatePasswordAsync.</summary>
    public Dictionary<string, DateTime?> PasswordUpdatedTimes { get; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Test access to the stored row (including the hash, which the API never returns).</summary>
    public LoginUser Find(string userId) => _users.Single(u => u.UserId == userId);

    // Mirrors the DB's case-insensitive, trailing-space-insensitive '=', so the controller's exact-match check is exercised.
    public Task<LoginUser?> GetLoginUserAsync(string userId)
        => Task.FromResult(_users.FirstOrDefault(u => string.Equals(u.UserId, userId.TrimEnd(), StringComparison.OrdinalIgnoreCase)));

    public Task<IReadOnlyList<string>> GetRoleIdsAsync(string userId)
        => Task.FromResult<IReadOnlyList<string>>(_roles.TryGetValue(userId, out var r) ? r.Order().ToList() : []);

    public Task<UserProfile?> GetProfileAsync(string userId)
    {
        var user = _users.FirstOrDefault(u => string.Equals(u.UserId, userId, StringComparison.OrdinalIgnoreCase));
        if (user is null) return Task.FromResult<UserProfile?>(null);
        var roleIds = _roles.TryGetValue(user.UserId, out var r) ? r : [];
        return Task.FromResult<UserProfile?>(new UserProfile
        {
            UserId = user.UserId,
            UserName = user.UserName,
            Roles = FakeAppUserRepository.Roles
                .Where(role => roleIds.Contains(role.RoleId, StringComparer.OrdinalIgnoreCase))
                .OrderBy(role => role.RoleId).ToList(),
        });
    }

    public Task<bool> UpdateUserNameAsync(string userId, string userName)
    {
        var user = _users.FirstOrDefault(u => string.Equals(u.UserId, userId, StringComparison.OrdinalIgnoreCase));
        if (user is not null) user.UserName = userName;
        return Task.FromResult(user is not null);
    }

    public Task<bool> UpdatePasswordAsync(string userId, string passwordHash, DateTime passwordUpdatedTime)
    {
        var user = _users.FirstOrDefault(u => string.Equals(u.UserId, userId, StringComparison.OrdinalIgnoreCase));
        if (user is null) return Task.FromResult(false);
        user.PasswordHash = passwordHash;
        PasswordUpdatedTimes[user.UserId] = passwordUpdatedTime;
        return Task.FromResult(true);
    }

    public Task<string?> GetSysConfigValueAsync(string configKey)
        => Task.FromResult(configKey == PasswordHasher.AppConfigKey ? AppConfigValue : null);
}
