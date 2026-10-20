using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests;

/// <summary>In-memory IAppUserRepository so endpoint tests run without SQL Server.</summary>
public class FakeAppUserRepository : IAppUserRepository
{
    /// <summary>Reference AppRole data checked by CheckRolesAsync (also served by FakeLookupRepository).</summary>
    public static readonly IReadOnlyList<AppRoleLookup> Roles =
    [
        new() { Pkid = 1, RoleId = "Admin", RoleName = "Administrator" },
        new() { Pkid = 2, RoleId = "User", RoleName = "User" },
        new() { Pkid = 3, RoleId = "Editor", RoleName = "Content Editor" },
    ];

    public const string DefaultPassword = "Def@ult1";

    private readonly object _lock = new();
    private readonly List<Row> _rows = [];
    private int _nextPkid = 1;

    /// <summary>SysConfig 'appConfig' value; tests may replace it (null = row missing).</summary>
    public string? AppConfigValue { get; set; } = $$"""{ "defaultPassword": "{{DefaultPassword}}", "enforcePasswordPolicy": true }""";

    public sealed class Row
    {
        public required AppUser User { get; init; }
        public List<string> RoleIds { get; set; } = [];
        public string PasswordHash { get; set; } = string.Empty;
        public string? AgentTokenHash { get; set; }

        /// <summary>Stand-in for the AgentTokenUsage FK count (tests set it to exercise the delete guard).</summary>
        public int AgentTokenUsageCount { get; set; }
    }

    /// <summary>Active user owning the token hash (used by FakeAgentTokenUsageRepository).</summary>
    public string? FindActiveUserIdByAgentTokenHash(string tokenHash)
    {
        lock (_lock) return _rows.FirstOrDefault(r => r.AgentTokenHash == tokenHash && r.User.IsActive)?.User.UserId;
    }

    /// <summary>Test helper: set the AgentTokenUsage count for a user.</summary>
    public void SetAgentTokenUsageCount(string userId, int count)
    {
        lock (_lock) _rows.First(r => r.User.UserId == userId).AgentTokenUsageCount = count;
    }

    public FakeAppUserRepository()
    {
        Seed("alice", "Alice", true, ["Admin", "User"]);
        Seed("bob", "Bob", false, ["User"]);
        Seed("carol", "Carol", true, []);
    }

    private void Seed(string userId, string userName, bool isActive, List<string> roleIds)
        => CreateAsync(new AppUserRequest { UserId = userId, UserName = userName, IsActive = isActive, RoleIds = roleIds },
            "seed-hash").GetAwaiter().GetResult();

    /// <summary>Test access to the stored row (including the hash, which the API never returns).</summary>
    public Row? Find(int pkid)
    {
        lock (_lock) return _rows.FirstOrDefault(r => r.User.Pkid == pkid);
    }

    private static AppUser Project(Row row, bool withRoles) => new()
    {
        Pkid = row.User.Pkid,
        UserId = row.User.UserId,
        UserName = row.User.UserName,
        IsActive = row.User.IsActive,
        PasswordUpdatedTime = row.User.PasswordUpdatedTime,
        RoleCount = row.RoleIds.Count,
        HasAgentToken = row.AgentTokenHash is not null,
        AgentTokenUsageCount = row.AgentTokenUsageCount,
        Roles = withRoles
            ? Roles.Where(r => row.RoleIds.Contains(r.RoleId, StringComparer.OrdinalIgnoreCase)).OrderBy(r => r.RoleId).ToList()
            : []
    };

    public Task<IEnumerable<AppUser>> GetAllAsync()
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<AppUser>>(
                _rows.OrderBy(r => r.User.UserId, StringComparer.Ordinal).Select(r => Project(r, false)).ToList());
    }

    public Task<IEnumerable<AppUser>> QueryAsync(AppUserQuery query)
    {
        lock (_lock)
        {
            IEnumerable<Row> q = _rows;
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var k = query.Keyword.Trim();
                q = q.Where(r => r.User.UserId.Contains(k, StringComparison.OrdinalIgnoreCase)
                              || r.User.UserName.Contains(k, StringComparison.OrdinalIgnoreCase));
            }
            if (query.IsActive.HasValue) q = q.Where(r => r.User.IsActive == query.IsActive);
            if (!string.IsNullOrWhiteSpace(query.RoleId))
                q = q.Where(r => r.RoleIds.Contains(query.RoleId.Trim(), StringComparer.OrdinalIgnoreCase));
            return Task.FromResult<IEnumerable<AppUser>>(
                q.OrderBy(r => r.User.UserId, StringComparer.Ordinal).Select(r => Project(r, false)).ToList());
        }
    }

    public Task<AppUser?> GetByIdAsync(int pkid)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(r => r.User.Pkid == pkid);
            return Task.FromResult(row is null ? null : Project(row, true));
        }
    }

    public Task<bool> UserIdExistsAsync(string userId)
    {
        lock (_lock)
            return Task.FromResult(_rows.Any(r => string.Equals(r.User.UserId, userId, StringComparison.OrdinalIgnoreCase)));
    }

    public Task<IReadOnlyList<string>> CheckRolesAsync(IEnumerable<string> roleIds)
        => Task.FromResult<IReadOnlyList<string>>(
            roleIds.Distinct().Where(id => !Roles.Any(r => string.Equals(r.RoleId, id, StringComparison.OrdinalIgnoreCase))).ToList());

    public Task<string?> GetSysConfigValueAsync(string configKey)
        => Task.FromResult(configKey == "appConfig" ? AppConfigValue : null);

    public Task<int> CreateAsync(AppUserRequest request, string passwordHash)
    {
        lock (_lock)
        {
            var row = new Row
            {
                User = new AppUser
                {
                    Pkid = _nextPkid++,
                    UserId = request.UserId,
                    UserName = request.UserName,
                    IsActive = request.IsActive,
                },
                RoleIds = request.RoleIds.Distinct().ToList(),
                PasswordHash = passwordHash,
            };
            _rows.Add(row);
            return Task.FromResult(row.User.Pkid);
        }
    }

    public Task<bool> UpdateAsync(AppUserRequest request)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(r => r.User.Pkid == request.Pkid);
            if (row is null) return Task.FromResult(false);
            row.User.UserName = request.UserName;
            row.User.IsActive = request.IsActive;
            row.RoleIds = request.RoleIds.Distinct().ToList();
            return Task.FromResult(true);
        }
    }

    public Task<bool> ResetPasswordAsync(int pkid, string passwordHash, DateTime passwordUpdatedTime)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(r => r.User.Pkid == pkid);
            if (row is null) return Task.FromResult(false);
            row.PasswordHash = passwordHash;
            row.User.PasswordUpdatedTime = passwordUpdatedTime;
            return Task.FromResult(true);
        }
    }

    public Task<bool> SetAgentTokenHashAsync(int pkid, string? tokenHash)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(r => r.User.Pkid == pkid);
            if (row is null) return Task.FromResult(false);
            row.AgentTokenHash = tokenHash;
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(int pkid)
    {
        lock (_lock)
            return Task.FromResult(_rows.RemoveAll(r => r.User.Pkid == pkid) > 0);
    }
}
