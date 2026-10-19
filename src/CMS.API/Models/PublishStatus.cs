namespace CMS.API.Models;

/// <summary>PublishStatus response model (發布狀態).</summary>
public class PublishStatus
{
    /// <summary>tinyint PK, user-supplied (not IDENTITY).</summary>
    public byte Pkid { get; set; }
    public string Description { get; set; } = string.Empty;
    public bool IsDraft { get; set; }
    public bool IsPublished { get; set; }
    public bool IsDiscontinued { get; set; }

    /// <summary>Course rows referencing this status (subquery count).</summary>
    public int CourseCount { get; set; }

    /// <summary>Promotion2 rows referencing this status (subquery count).</summary>
    public int Promotion2Count { get; set; }
}
