using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IFeaturedPromoItemRepository
{
    /// <summary>Items with ScheduleOn in [from, to], optionally for one training center.</summary>
    Task<IEnumerable<FeaturedPromoItem>> QueryAsync(short? trainingCenterPkid, DateOnly from, DateOnly to);

    Task<FeaturedPromoItem?> GetByIdAsync(int pkid);

    /// <summary>True if another row (not <paramref name="excludePkid"/>) already uses the date / center / slot.</summary>
    Task<bool> SlotTakenAsync(DateOnly scheduleOn, short trainingCenterPkid, byte slot, int excludePkid);

    Task<FeaturedPromoItemReferenceCheck> CheckReferencesAsync(short trainingCenterPkid, int promotionPkid);

    Task<int> CreateAsync(FeaturedPromoItemRequest request);
    Task<bool> UpdateAsync(FeaturedPromoItemRequest request);
    Task<bool> DeleteAsync(int pkid);

    /// <summary>Moves the item to <paramref name="targetSlot"/>, swapping with the item already there (if any).</summary>
    Task<bool> MoveAsync(int pkid, byte targetSlot);
}

public class FeaturedPromoItemReferenceCheck
{
    public bool TrainingCenterExists { get; set; }
    public bool PromotionExists { get; set; }
}
