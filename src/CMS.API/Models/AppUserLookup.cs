namespace CMS.API.Models;

/// <summary>Slim AppUser for lookups / nav objects.</summary>
public class AppUserLookup
{
    public int Pkid { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
}
