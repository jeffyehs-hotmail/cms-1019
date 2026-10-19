namespace CMS.API.Models;

/// <summary>Partner search DTO.</summary>
public class PartnerQuery
{
    /// <summary>LIKE on Name, AppKey, NameOnPartnerMenu, NameOnCourseDetailPage, ImageFilename.</summary>
    public string? Keyword { get; set; }
}
