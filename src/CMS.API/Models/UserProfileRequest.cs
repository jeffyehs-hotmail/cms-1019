using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>
/// PUT api/auth/profile body. Only UserName is editable; the UserId comes from the JWT,
/// so a UserId (or roles) sent in the body is never bound.
/// </summary>
public class UserProfileRequest
{
    [Required, StringLength(200)]
    public string UserName { get; set; } = string.Empty;
}
