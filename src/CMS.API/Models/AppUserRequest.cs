using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>
/// AppUser write DTO. UserId is the table PK and is immutable on update.
/// PasswordHash is deliberately absent: it is set server-side on create / reset only.
/// </summary>
public class AppUserRequest
{
    /// <summary>Required on PUT; ignored on POST.</summary>
    public int Pkid { get; set; }

    [Required, StringLength(200)]
    public string UserId { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string UserName { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    /// <summary>n-n AppUserRole: assigned AppRole.RoleId values.</summary>
    public List<string> RoleIds { get; set; } = [];
}
