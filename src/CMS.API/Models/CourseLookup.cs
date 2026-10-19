namespace CMS.API.Models;

/// <summary>Slim Course for lookups / FK dropdowns.</summary>
public class CourseLookup
{
    public int Pkid { get; set; }
    public string CourseId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
}
