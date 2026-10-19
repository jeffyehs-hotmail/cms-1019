using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>PublishStatus write DTO. Pkid is supplied on POST and immutable on PUT.</summary>
public class PublishStatusRequest
{
    [Range(1, 255)]
    public byte Pkid { get; set; }

    [Required, StringLength(50)]
    public string Description { get; set; } = string.Empty;

    public bool IsDraft { get; set; }
    public bool IsPublished { get; set; }
    public bool IsDiscontinued { get; set; }
}
