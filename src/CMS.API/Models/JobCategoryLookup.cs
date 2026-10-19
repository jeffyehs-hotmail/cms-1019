namespace CMS.API.Models;

/// <summary>Slim JobCategory for lookups / n-n selection.</summary>
public class JobCategoryLookup
{
    public short Pkid { get; set; }
    public string Description { get; set; } = string.Empty;
}
