namespace CMS.API.Models;

/// <summary>GET / PUT api/auth/profile response: the signed-in user's own profile.</summary>
public class UserProfile
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public List<AppRoleLookup> Roles { get; set; } = [];
}
