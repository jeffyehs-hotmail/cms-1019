using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>Partner write DTO. Pkid is ignored on POST (IDENTITY) and required on PUT.</summary>
public class PartnerRequest
{
    public short Pkid { get; set; }

    [Required, StringLength(50)]
    public string Name { get; set; } = string.Empty;

    /// <summary>varchar(10) — printable ASCII only.</summary>
    [Required, StringLength(10), RegularExpression(@"^[\x20-\x7E]+$", ErrorMessage = "應用代碼僅限英數字元")]
    public string AppKey { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string NameOnPartnerMenu { get; set; } = string.Empty;

    [Required, StringLength(50)]
    public string NameOnCourseDetailPage { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }

    /// <summary>varchar(50) — printable ASCII only.</summary>
    [StringLength(50), RegularExpression(@"^[\x20-\x7E]*$", ErrorMessage = "圖檔名稱僅限英數字元")]
    public string? ImageFilename { get; set; }
}
