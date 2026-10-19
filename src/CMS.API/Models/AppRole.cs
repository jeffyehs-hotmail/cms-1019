namespace CMS.API.Models;

/// <summary>AppRole response model (使用者角色).</summary>
public class AppRole
{
    public int Pkid { get; set; }
    public string RoleId { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public int PermissionLevel { get; set; }
    public string? Description { get; set; }

    /// <summary>Number of users assigned via AppUserRole (n-n subquery count).</summary>
    public int UserCount { get; set; }

    /// <summary>Assigned users; populated on single-record reads only.</summary>
    public List<AppUserLookup> Users { get; set; } = [];
}
