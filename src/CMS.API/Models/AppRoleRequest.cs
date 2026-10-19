using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>AppRole write DTO. RoleId is the table PK and is immutable on update.</summary>
public class AppRoleRequest
{
    /// <summary>Required on PUT; ignored on POST.</summary>
    public int Pkid { get; set; }

    [Required, StringLength(200)]
    public string RoleId { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string RoleName { get; set; } = string.Empty;

    [Required]
    public int PermissionLevel { get; set; } = 100;

    [StringLength(400)]
    public string? Description { get; set; }

    /// <summary>n-n AppUserRole: assigned AppUser.UserId values.</summary>
    public List<string> UserIds { get; set; } = [];
}
