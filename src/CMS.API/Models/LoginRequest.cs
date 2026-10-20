using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>POST api/auth/login body.</summary>
public class LoginRequest
{
    [Required, StringLength(200)]
    public string UserId { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}
