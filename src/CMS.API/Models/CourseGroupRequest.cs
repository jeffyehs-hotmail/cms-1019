using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>CourseGroup write DTO. Pkid is ignored on POST (IDENTITY) and required on PUT.</summary>
public class CourseGroupRequest
{
    public short Pkid { get; set; }

    [Required, StringLength(100)]
    public string Description { get; set; } = string.Empty;
}
