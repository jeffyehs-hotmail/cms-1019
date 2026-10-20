namespace CMS.API.Models;

/// <summary>Slim TrainingCenter for lookups (ordered by DisplayOrder).</summary>
public class TrainingCenterLookup
{
    public short Pkid { get; set; }
    public string Name { get; set; } = string.Empty;
}
