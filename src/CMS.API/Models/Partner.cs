namespace CMS.API.Models;

/// <summary>Partner response model (原廠).</summary>
public class Partner
{
    public short Pkid { get; set; }
    public string Name { get; set; } = string.Empty;
    public string AppKey { get; set; } = string.Empty;
    public string NameOnPartnerMenu { get; set; } = string.Empty;
    public string NameOnCourseDetailPage { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public string? ImageFilename { get; set; }

    /// <summary>Course rows referencing this partner (subquery count).</summary>
    public int CourseCount { get; set; }

    /// <summary>Certification rows referencing this partner (subquery count).</summary>
    public int CertificationCount { get; set; }

    /// <summary>PartnerCourseGroup rows referencing this partner (subquery count).</summary>
    public int PartnerCourseGroupCount { get; set; }

    /// <summary>Promotion2 rows referencing this partner via RelatedPartner_pkid (subquery count).</summary>
    public int Promotion2Count { get; set; }

    /// <summary>Seminar rows referencing this partner (no FK constraint; subquery count).</summary>
    public int SeminarCount { get; set; }
}
