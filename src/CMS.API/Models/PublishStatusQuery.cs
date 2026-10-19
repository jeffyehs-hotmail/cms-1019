namespace CMS.API.Models;

/// <summary>PublishStatus search DTO.</summary>
public class PublishStatusQuery
{
    /// <summary>LIKE on Description.</summary>
    public string? Keyword { get; set; }

    public bool? IsDraft { get; set; }
    public bool? IsPublished { get; set; }
    public bool? IsDiscontinued { get; set; }
}
