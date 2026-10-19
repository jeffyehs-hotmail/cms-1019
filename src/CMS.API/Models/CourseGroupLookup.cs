namespace CMS.API.Models;

/// <summary>Slim CourseGroup for lookups / FK dropdowns.</summary>
public class CourseGroupLookup
{
    public short Pkid { get; set; }
    public string Description { get; set; } = string.Empty;
}
