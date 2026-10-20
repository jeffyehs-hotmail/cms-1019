using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>
/// POST api/auth/change-password body. The UserId comes from the JWT, so none is bound;
/// passwords travel in plain text (over HTTPS) and only their hashes are stored.
/// </summary>
public class ChangePasswordRequest
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    public string NewPassword { get; set; } = string.Empty;

    [Required]
    public string ConfirmPassword { get; set; } = string.Empty;
}
