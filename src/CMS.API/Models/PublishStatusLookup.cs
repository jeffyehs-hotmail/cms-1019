namespace CMS.API.Models;

/// <summary>Slim PublishStatus for lookups / FK dropdowns.</summary>
public class PublishStatusLookup
{
    public byte Pkid { get; set; }
    public string Description { get; set; } = string.Empty;
}
