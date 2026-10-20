namespace CMS.API.Models;

/// <summary>
/// Server-only AppUser row used to check credentials. Includes PasswordHash,
/// so it must never be returned from a controller.
/// </summary>
public class LoginUser
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
}
