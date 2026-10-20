using System.Text;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class FeaturedPromoItemRepository(IDbConnectionFactory db) : IFeaturedPromoItemRepository
{
    private const string SelectSql = """
        SELECT f.pkid, f.ScheduleOn, f.TrainingCenter_pkid AS TrainingCenterPkid, t.Name AS TrainingCenterName,
               f.Slot, f.Promotion_pkid AS PromotionPkid, p.PromoCode, f.Topic, f.Description
        FROM FeaturedPromoItem f
        JOIN TrainingCenter t ON t.pkid = f.TrainingCenter_pkid
        JOIN Promotion2 p ON p.pkid = f.Promotion_pkid
        """;

    public async Task<IEnumerable<FeaturedPromoItem>> QueryAsync(short? trainingCenterPkid, DateOnly from, DateOnly to)
    {
        var sql = new StringBuilder(SelectSql).Append(" WHERE f.ScheduleOn >= @from AND f.ScheduleOn <= @to");
        var p = new DynamicParameters();
        p.Add("from", from);
        p.Add("to", to);
        if (trainingCenterPkid.HasValue)
        {
            sql.Append(" AND f.TrainingCenter_pkid = @trainingCenterPkid");
            p.Add("trainingCenterPkid", trainingCenterPkid);
        }
        sql.Append(" ORDER BY f.ScheduleOn, t.DisplayOrder, f.Slot");

        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<FeaturedPromoItem>(sql.ToString(), p);
    }

    public async Task<FeaturedPromoItem?> GetByIdAsync(int pkid)
    {
        using var conn = await db.OpenAsync();
        return await conn.QuerySingleOrDefaultAsync<FeaturedPromoItem>(SelectSql + " WHERE f.pkid = @pkid", new { pkid });
    }

    public async Task<bool> SlotTakenAsync(DateOnly scheduleOn, short trainingCenterPkid, byte slot, int excludePkid)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<bool>("""
            SELECT CASE WHEN EXISTS (
                SELECT 1 FROM FeaturedPromoItem
                WHERE ScheduleOn = @scheduleOn AND TrainingCenter_pkid = @trainingCenterPkid AND Slot = @slot
                  AND pkid <> @excludePkid) THEN 1 ELSE 0 END
            """, new { scheduleOn, trainingCenterPkid, slot, excludePkid });
    }

    public async Task<FeaturedPromoItemReferenceCheck> CheckReferencesAsync(short trainingCenterPkid, int promotionPkid)
    {
        using var conn = await db.OpenAsync();
        return await conn.QuerySingleAsync<FeaturedPromoItemReferenceCheck>("""
            SELECT CAST(CASE WHEN EXISTS (SELECT 1 FROM TrainingCenter WHERE pkid = @trainingCenterPkid) THEN 1 ELSE 0 END AS bit) AS TrainingCenterExists,
                   CAST(CASE WHEN EXISTS (SELECT 1 FROM Promotion2 WHERE pkid = @promotionPkid) THEN 1 ELSE 0 END AS bit) AS PromotionExists
            """, new { trainingCenterPkid, promotionPkid });
    }

    public async Task<int> CreateAsync(FeaturedPromoItemRequest request)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<int>("""
            INSERT INTO FeaturedPromoItem (ScheduleOn, TrainingCenter_pkid, Slot, Promotion_pkid, Topic, Description)
            VALUES (@ScheduleOn, @TrainingCenterPkid, @Slot, @PromotionPkid, @Topic, @Description);
            SELECT CAST(SCOPE_IDENTITY() AS int);
            """, ToParams(request));
    }

    public async Task<bool> UpdateAsync(FeaturedPromoItemRequest request)
    {
        using var conn = await db.OpenAsync();
        var rows = await conn.ExecuteAsync("""
            UPDATE FeaturedPromoItem
            SET ScheduleOn = @ScheduleOn, TrainingCenter_pkid = @TrainingCenterPkid, Slot = @Slot,
                Promotion_pkid = @PromotionPkid, Topic = @Topic, Description = @Description
            WHERE pkid = @Pkid
            """, ToParams(request));
        return rows > 0;
    }

    public async Task<bool> DeleteAsync(int pkid)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteAsync("DELETE FROM FeaturedPromoItem WHERE pkid = @pkid", new { pkid }) > 0;
    }

    public async Task<bool> MoveAsync(int pkid, byte targetSlot)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        var item = await conn.QuerySingleOrDefaultAsync<(DateOnly ScheduleOn, short TrainingCenterPkid, byte Slot)>("""
            SELECT ScheduleOn, TrainingCenter_pkid, Slot FROM FeaturedPromoItem WITH (UPDLOCK) WHERE pkid = @pkid
            """, new { pkid }, tx);
        if (item == default) return false;
        if (item.Slot == targetSlot)
        {
            tx.Commit();
            return true;
        }

        var neighbor = await conn.ExecuteScalarAsync<int?>("""
            SELECT pkid FROM FeaturedPromoItem WITH (UPDLOCK)
            WHERE ScheduleOn = @ScheduleOn AND TrainingCenter_pkid = @TrainingCenterPkid AND Slot = @targetSlot
            """, new { item.ScheduleOn, item.TrainingCenterPkid, targetSlot }, tx);

        // Swap through slot 0 so the UNIQUE (ScheduleOn, TrainingCenter_pkid, Slot) index is never violated.
        await conn.ExecuteAsync("UPDATE FeaturedPromoItem SET Slot = 0 WHERE pkid = @pkid", new { pkid }, tx);
        if (neighbor.HasValue)
            await conn.ExecuteAsync("UPDATE FeaturedPromoItem SET Slot = @slot WHERE pkid = @neighbor",
                new { slot = item.Slot, neighbor }, tx);
        await conn.ExecuteAsync("UPDATE FeaturedPromoItem SET Slot = @targetSlot WHERE pkid = @pkid", new { targetSlot, pkid }, tx);

        tx.Commit();
        return true;
    }

    private static DynamicParameters ToParams(FeaturedPromoItemRequest r)
    {
        var p = new DynamicParameters();
        p.Add("Pkid", r.Pkid);
        p.Add("ScheduleOn", r.ScheduleOn!.Value);
        p.Add("TrainingCenterPkid", r.TrainingCenterPkid);
        p.Add("Slot", r.Slot);
        p.Add("PromotionPkid", r.PromotionPkid);
        p.Add("Topic", r.Topic);
        p.Add("Description", r.Description);
        return p;
    }
}
