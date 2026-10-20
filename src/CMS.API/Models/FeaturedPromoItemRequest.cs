using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>FeaturedPromoItem write DTO. (ScheduleOn, TrainingCenter, Slot) is unique in the DB.</summary>
public class FeaturedPromoItemRequest
{
    /// <summary>Required on PUT; ignored on POST.</summary>
    public int Pkid { get; set; }

    [Required]
    public DateOnly? ScheduleOn { get; set; }

    [Range(1, short.MaxValue)]
    public short TrainingCenterPkid { get; set; }

    [Range(1, FeaturedPromoItem.MaxSlot)]
    public byte Slot { get; set; }

    [Range(1, int.MaxValue)]
    public int PromotionPkid { get; set; }

    [Required, StringLength(100)]
    public string Topic { get; set; } = string.Empty;

    [Required, StringLength(300)]
    public string Description { get; set; } = string.Empty;
}
