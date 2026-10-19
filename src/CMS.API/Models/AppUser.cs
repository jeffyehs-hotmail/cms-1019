namespace CMS.API.Models;

/// <summary>AppUser response model (使用者). PasswordHash is never exposed.</summary>
public class AppUser
{
    public int Pkid { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; }

    /// <summary>NULL = still on the default password (set on create / reset).</summary>
    public DateTime? PasswordUpdatedTime { get; set; }

    /// <summary>Number of roles assigned via AppUserRole (n-n subquery count).</summary>
    public int RoleCount { get; set; }

    /// <summary>Assigned roles; populated on single-record reads only.</summary>
    public List<AppRoleLookup> Roles { get; set; } = [];
}
