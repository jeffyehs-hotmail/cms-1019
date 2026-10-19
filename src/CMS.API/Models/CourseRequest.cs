using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>Course write DTO. Pkid is ignored on POST (IDENTITY) and required on PUT.</summary>
public class CourseRequest
{
    public int Pkid { get; set; }

    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [StringLength(300)]
    public string? OfficialTitle { get; set; }

    /// <summary>varchar(50) — printable ASCII only; unique (enforced by the API).</summary>
    [Required, StringLength(50), RegularExpression(@"^[\x20-\x7E]+$", ErrorMessage = "簡介代碼僅限英數字元")]
    public string CourseId { get; set; } = string.Empty;

    /// <summary>varchar(50) — printable ASCII only.</summary>
    [Required, StringLength(50), RegularExpression(@"^[\x20-\x7E]+$", ErrorMessage = "科目代碼僅限英數字元")]
    public string ProdCourseId { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string FriendlyUrl { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }

    [Range(1, short.MaxValue, ErrorMessage = "請選擇原廠")]
    public short PartnerPkid { get; set; }

    public short? CourseGroupPkid { get; set; }

    [Range(1, byte.MaxValue, ErrorMessage = "請選擇上架狀態")]
    public byte PublishStatusPkid { get; set; }

    [Required]
    public DateOnly? ScheduleOn { get; set; }

    [Required]
    public DateOnly? ScheduleOff { get; set; }

    [Range(0, short.MaxValue)]
    public short Hour { get; set; }

    /// <summary>decimal(9,0).</summary>
    [Range(typeof(decimal), "0", "999999999")]
    public decimal ListPrice { get; set; }

    /// <summary>decimal(9,1).</summary>
    [Range(typeof(decimal), "0", "99999999.9")]
    public decimal LearningCredit { get; set; }

    public bool CanRepeat { get; set; }

    [StringLength(500)]
    public string? Material { get; set; }

    [StringLength(4000)]
    public string? Objective { get; set; }

    [StringLength(500)]
    public string? Target { get; set; }

    [StringLength(4000)]
    public string? Prerequisites { get; set; }

    /// <summary>nvarchar(max).</summary>
    public string? Outline { get; set; }

    /// <summary>nvarchar(max).</summary>
    public string? TowardCertOrExam { get; set; }

    [StringLength(4000)]
    public string? Note { get; set; }

    [StringLength(4000)]
    public string? OtherInfo { get; set; }

    /// <summary>n-n CourseInCertification.</summary>
    public List<int> CertificationPkids { get; set; } = [];

    /// <summary>n-n CourseJobCategories.</summary>
    public List<short> JobCategoryPkids { get; set; } = [];
}
