namespace CMS.API.Models;

/// <summary>FeaturedPromoItem response model (首頁上稿): one promotion slot on one day for one training center.</summary>
public class FeaturedPromoItem
{
    /// <summary>Slots per day and training center (1..MaxSlot).</summary>
    public const byte MaxSlot = 3;

    public int Pkid { get; set; }
    public DateOnly ScheduleOn { get; set; }
    public short TrainingCenterPkid { get; set; }
    public string TrainingCenterName { get; set; } = string.Empty;
    public byte Slot { get; set; }
    public int PromotionPkid { get; set; }

    /// <summary>Promotion2.PromoCode (JOINed label).</summary>
    public string PromoCode { get; set; } = string.Empty;

    public string Topic { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}
