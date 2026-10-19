namespace CMS.API.Models;

/// <summary>CourseGroup response model (課程群組).</summary>
public class CourseGroup
{
    public short Pkid { get; set; }
    public string Description { get; set; } = string.Empty;

    /// <summary>Course rows referencing this group (subquery count).</summary>
    public int CourseCount { get; set; }

    /// <summary>PartnerCourseGroup rows referencing this group (subquery count).</summary>
    public int PartnerCourseGroupCount { get; set; }
}
