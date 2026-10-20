using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests;

/// <summary>In-memory IFeaturedPromoItemRepository so endpoint tests run without SQL Server.</summary>
public class FakeFeaturedPromoItemRepository : IFeaturedPromoItemRepository
{
    /// <summary>Reference TrainingCenter data in DisplayOrder (also served by FakeLookupRepository). Note pkid 5 before 54.</summary>
    public static readonly IReadOnlyList<TrainingCenterLookup> TrainingCenters =
    [
        new() { Pkid = 1, Name = "台北" },
        new() { Pkid = 2, Name = "新竹" },
        new() { Pkid = 3, Name = "台中" },
        new() { Pkid = 5, Name = "高雄" },
        new() { Pkid = 54, Name = "線上研討會" },
    ];

    /// <summary>Reference Promotion2 data (also served by FakeLookupRepository).</summary>
    public static readonly IReadOnlyList<PromotionLookup> Promotions =
    [
        new() { Pkid = 101, PromoCode = "20251204_SkillTrainAI", Topic = "成為能AI協作的程式設計師", Description = "轉職就業養成班" },
        new() { Pkid = 102, PromoCode = "251211_GoogleAI", Topic = "Google AI工具一次掌握", Description = "不需技術基礎" },
        new() { Pkid = 103, PromoCode = "20251215_n8n", Topic = "n8n自動化三部曲", Description = "從自動化新手到架構師" },
        new() { Pkid = 104, PromoCode = "240614_MSAI", Topic = "教你把AI變成實戰力", Description = "用GitHub Copilot" },
    ];

    private readonly object _lock = new();
    private readonly List<FeaturedPromoItem> _rows = [];
    private int _nextPkid = 1;

    public FakeFeaturedPromoItemRepository()
    {
        // Week of Mon 2026-03-16 .. Sun 2026-03-22, plus rows just outside it.
        Seed(new DateOnly(2026, 3, 16), 1, 1, 101); // pkid 1
        Seed(new DateOnly(2026, 3, 16), 1, 2, 102); // pkid 2
        Seed(new DateOnly(2026, 3, 16), 1, 3, 103); // pkid 3
        Seed(new DateOnly(2026, 3, 22), 1, 1, 101); // pkid 4 (Sunday)
        Seed(new DateOnly(2026, 3, 23), 1, 1, 102); // pkid 5 (next Monday)
        Seed(new DateOnly(2026, 3, 15), 1, 1, 103); // pkid 6 (previous Sunday)
        Seed(new DateOnly(2026, 3, 18), 2, 1, 102); // pkid 7 (新竹)
    }

    private void Seed(DateOnly date, short center, byte slot, int promo)
    {
        var p = Promotions.Single(x => x.Pkid == promo);
        CreateAsync(new FeaturedPromoItemRequest
        {
            ScheduleOn = date, TrainingCenterPkid = center, Slot = slot, PromotionPkid = promo,
            Topic = p.Topic, Description = p.Description,
        }).GetAwaiter().GetResult();
    }

    private static int CenterOrder(short pkid)
    {
        for (var i = 0; i < TrainingCenters.Count; i++)
            if (TrainingCenters[i].Pkid == pkid) return i;
        return int.MaxValue;
    }

    private static FeaturedPromoItem Copy(FeaturedPromoItem f) => new()
    {
        Pkid = f.Pkid, ScheduleOn = f.ScheduleOn, TrainingCenterPkid = f.TrainingCenterPkid,
        TrainingCenterName = TrainingCenters.Single(t => t.Pkid == f.TrainingCenterPkid).Name,
        Slot = f.Slot, PromotionPkid = f.PromotionPkid,
        PromoCode = Promotions.Single(p => p.Pkid == f.PromotionPkid).PromoCode,
        Topic = f.Topic, Description = f.Description,
    };

    public Task<IEnumerable<FeaturedPromoItem>> QueryAsync(short? trainingCenterPkid, DateOnly from, DateOnly to)
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<FeaturedPromoItem>>(_rows
                .Where(r => r.ScheduleOn >= from && r.ScheduleOn <= to)
                .Where(r => trainingCenterPkid is null || r.TrainingCenterPkid == trainingCenterPkid)
                .OrderBy(r => r.ScheduleOn).ThenBy(r => CenterOrder(r.TrainingCenterPkid)).ThenBy(r => r.Slot)
                .Select(Copy).ToList());
    }

    public Task<FeaturedPromoItem?> GetByIdAsync(int pkid)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(r => r.Pkid == pkid);
            return Task.FromResult(row is null ? null : Copy(row));
        }
    }

    public Task<bool> SlotTakenAsync(DateOnly scheduleOn, short trainingCenterPkid, byte slot, int excludePkid)
    {
        lock (_lock)
            return Task.FromResult(_rows.Any(r => r.ScheduleOn == scheduleOn && r.TrainingCenterPkid == trainingCenterPkid
                                                  && r.Slot == slot && r.Pkid != excludePkid));
    }

    public Task<FeaturedPromoItemReferenceCheck> CheckReferencesAsync(short trainingCenterPkid, int promotionPkid)
        => Task.FromResult(new FeaturedPromoItemReferenceCheck
        {
            TrainingCenterExists = TrainingCenters.Any(t => t.Pkid == trainingCenterPkid),
            PromotionExists = Promotions.Any(p => p.Pkid == promotionPkid),
        });

    public Task<int> CreateAsync(FeaturedPromoItemRequest request)
    {
        lock (_lock)
        {
            if (_rows.Any(r => r.ScheduleOn == request.ScheduleOn && r.TrainingCenterPkid == request.TrainingCenterPkid
                               && r.Slot == request.Slot))
                throw new InvalidOperationException("UNIQUE (ScheduleOn, TrainingCenter_pkid, Slot) violated");
            var row = new FeaturedPromoItem { Pkid = _nextPkid++ };
            Apply(row, request);
            _rows.Add(row);
            return Task.FromResult(row.Pkid);
        }
    }

    public Task<bool> UpdateAsync(FeaturedPromoItemRequest request)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(r => r.Pkid == request.Pkid);
            if (row is null) return Task.FromResult(false);
            Apply(row, request);
            return Task.FromResult(true);
        }
    }

    private static void Apply(FeaturedPromoItem row, FeaturedPromoItemRequest r)
    {
        row.ScheduleOn = r.ScheduleOn!.Value;
        row.TrainingCenterPkid = r.TrainingCenterPkid;
        row.Slot = r.Slot;
        row.PromotionPkid = r.PromotionPkid;
        row.Topic = r.Topic;
        row.Description = r.Description;
    }

    public Task<bool> DeleteAsync(int pkid)
    {
        lock (_lock)
            return Task.FromResult(_rows.RemoveAll(r => r.Pkid == pkid) > 0);
    }

    public Task<bool> MoveAsync(int pkid, byte targetSlot)
    {
        lock (_lock)
        {
            var row = _rows.FirstOrDefault(r => r.Pkid == pkid);
            if (row is null) return Task.FromResult(false);
            var neighbor = _rows.FirstOrDefault(r => r.ScheduleOn == row.ScheduleOn
                && r.TrainingCenterPkid == row.TrainingCenterPkid && r.Slot == targetSlot);
            if (neighbor is not null) neighbor.Slot = row.Slot;
            row.Slot = targetSlot;
            return Task.FromResult(true);
        }
    }
}
