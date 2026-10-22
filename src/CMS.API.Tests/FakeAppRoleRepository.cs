using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests;

/// <summary>In-memory IAppRoleRepository so endpoint tests run without SQL Server.</summary>
public class FakeAppRoleRepository : IAppRoleRepository
{
    private readonly object _lock = new();
    private readonly List<(AppRole Role, List<string> UserIds)> _rows = [];
    private int _nextPkid = 1;

    public FakeAppRoleRepository()
    {
        Seed("Admin", "Administrator", 1, "系統管理員", ["alice", "bob"]);
        Seed("User", "User", 100, "一般使用者", ["carol"]);
        Seed("Editor", "Content Editor", 50, null, []);
    }

    private void Seed(string roleId, string roleName, int level, string? description, List<string> userIds)
        => CreateAsync(new AppRoleRequest
        {
            RoleId = roleId, RoleName = roleName, PermissionLevel = level,
            Description = description, UserIds = userIds
        }).GetAwaiter().GetResult();

    private static AppRole Project((AppRole Role, List<string> UserIds) row, bool withUsers) => new()
    {
        Pkid = row.Role.Pkid,
        RoleId = row.Role.RoleId,
        RoleName = row.Role.RoleName,
        PermissionLevel = row.Role.PermissionLevel,
        Description = row.Role.Description,
        UserCount = row.UserIds.Count,
        Users = withUsers
            ? row.UserIds.Select(u => new AppUserLookup { UserId = u, UserName = u }).ToList()
            : []
    };

    public Task<IEnumerable<AppRole>> GetAllAsync()
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<AppRole>>(
                _rows.OrderBy(r => r.Role.RoleId).Select(r => Project(r, false)).ToList());
    }

    public Task<IEnumerable<AppRole>> QueryAsync(AppRoleQuery query)
    {
        lock (_lock)
        {
            IEnumerable<(AppRole Role, List<string> UserIds)> q = _rows;
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var k = query.Keyword.Trim();
                q = q.Where(r => r.Role.RoleId.Contains(k, StringComparison.OrdinalIgnoreCase)
                              || r.Role.RoleName.Contains(k, StringComparison.OrdinalIgnoreCase)
                              || (r.Role.Description?.Contains(k, StringComparison.OrdinalIgnoreCase) ?? false));
            }
            if (query.PermissionLevelFrom.HasValue) q = q.Where(r => r.Role.PermissionLevel >= query.PermissionLevelFrom);
            if (query.PermissionLevelTo.HasValue) q = q.Where(r => r.Role.PermissionLevel <= query.PermissionLevelTo);
            return Task.FromResult<IEnumerable<AppRole>>(
                q.OrderBy(r => r.Role.RoleId).Select(r => Project(r, false)).ToList());
        }
    }

    public Task<AppRole?> GetByIdAsync(int pkid)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(r => r.Role.Pkid == pkid);
            return Task.FromResult(row.Role is null ? null : Project(row, true));
        }
    }

    public Task<bool> RoleIdExistsAsync(string roleId)
    {
        lock (_lock)
            return Task.FromResult(_rows.Any(r => string.Equals(r.Role.RoleId, roleId, StringComparison.OrdinalIgnoreCase)));
    }

    /// <summary>AppUser ids CheckUsersAsync accepts (the seeded members).</summary>
    public static readonly IReadOnlyList<string> Users = ["alice", "bob", "carol"];

    public Task<IReadOnlyList<string>> CheckUsersAsync(IEnumerable<string> userIds)
        => Task.FromResult<IReadOnlyList<string>>(
            userIds.Distinct().Where(id => !Users.Contains(id, StringComparer.OrdinalIgnoreCase)).ToList());

    public Task<int> CreateAsync(AppRoleRequest request)
    {
        lock (_lock)
        {
            var role = new AppRole
            {
                Pkid = _nextPkid++,
                RoleId = request.RoleId,
                RoleName = request.RoleName,
                PermissionLevel = request.PermissionLevel,
                Description = request.Description
            };
            _rows.Add((role, request.UserIds.Distinct().ToList()));
            return Task.FromResult(role.Pkid);
        }
    }

    public Task<bool> UpdateAsync(AppRoleRequest request)
    {
        lock (_lock)
        {
            var idx = _rows.FindIndex(r => r.Role.Pkid == request.Pkid);
            if (idx < 0) return Task.FromResult(false);
            var role = _rows[idx].Role;
            role.RoleName = request.RoleName;
            role.PermissionLevel = request.PermissionLevel;
            role.Description = request.Description;
            _rows[idx] = (role, request.UserIds.Distinct().ToList());
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(int pkid)
    {
        lock (_lock)
            return Task.FromResult(_rows.RemoveAll(r => r.Role.Pkid == pkid) > 0);
    }
}
