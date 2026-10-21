namespace CMS.API.Models;

/// <summary>Course response model (課程). List results leave the long-text columns null.</summary>
public class Course
{
    public int Pkid { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? OfficialTitle { get; set; }
    public string CourseId { get; set; } = string.Empty;
    public string ProdCourseId { get; set; } = string.Empty;
    public string FriendlyUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }

    public short PartnerPkid { get; set; }
    /// <summary>Partner.Name (JOIN).</summary>
    public string PartnerName { get; set; } = string.Empty;
    public short? CourseGroupPkid { get; set; }
    /// <summary>CourseGroup.Description (LEFT JOIN; null when no group).</summary>
    public string? CourseGroupDescription { get; set; }
    public byte PublishStatusPkid { get; set; }
    /// <summary>PublishStatus.Description (JOIN).</summary>
    public string PublishStatusDescription { get; set; } = string.Empty;
    /// <summary>PublishStatus.IsPublished (JOIN; NOT NULL bit). The brochure omits the QR code when false.</summary>
    public bool PublishStatusIsPublished { get; set; }

    public DateOnly ScheduleOn { get; set; }
    public DateOnly ScheduleOff { get; set; }
    public short Hour { get; set; }
    public decimal ListPrice { get; set; }
    public decimal LearningCredit { get; set; }
    public bool CanRepeat { get; set; }

    // Long texts — populated only on GET by id.
    public string? Material { get; set; }
    public string? Objective { get; set; }
    public string? Target { get; set; }
    public string? Prerequisites { get; set; }
    public string? Outline { get; set; }
    public string? TowardCertOrExam { get; set; }
    public string? Note { get; set; }
    public string? OtherInfo { get; set; }

    /// <summary>CourseFAQ rows referencing this course (subquery count).</summary>
    public int CourseFaqCount { get; set; }

    /// <summary>CourseRelatedLink rows referencing this course (subquery count).</summary>
    public int CourseRelatedLinkCount { get; set; }

    /// <summary>HotCourse rows referencing this course (subquery count).</summary>
    public int HotCourseCount { get; set; }

    /// <summary>n-n via CourseInCertification — populated only on GET by id.</summary>
    public List<CertificationLookup> Certifications { get; set; } = [];

    /// <summary>n-n via CourseJobCategories — populated only on GET by id.</summary>
    public List<JobCategoryLookup> JobCategories { get; set; } = [];
}
