namespace CMS.API.Models;

/// <summary>AppRole search DTO.</summary>
public class AppRoleQuery
{
    /// <summary>LIKE on RoleId, RoleName, Description.</summary>
    public string? Keyword { get; set; }

    public int? PermissionLevelFrom { get; set; }
    public int? PermissionLevelTo { get; set; }
}
