namespace CMS.API.Models;

/// <summary>Slim AppRole for lookups / nav objects.</summary>
public class AppRoleLookup
{
    public int Pkid { get; set; }
    public string RoleId { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
}
