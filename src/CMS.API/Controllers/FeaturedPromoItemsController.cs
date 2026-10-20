using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

/// <summary>
/// 首頁上稿: a week grid per training center (no GET-all — the table holds years of daily rows).
/// </summary>
[ApiController]
[Route("api/featured-promo-items")]
public class FeaturedPromoItemsController(IFeaturedPromoItemRepository repo, TimeProvider clock) : ControllerBase
{
    /// <summary>Items for the Monday–Sunday week containing <c>WeekOf</c> (default: this week).</summary>
    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<FeaturedPromoItem>>> Query([FromBody] FeaturedPromoItemQuery query)
    {
        var day = query.WeekOf ?? DateOnly.FromDateTime(clock.GetLocalNow().DateTime);
        var (monday, sunday) = FeaturedPromoItemQuery.WeekRange(day);
        return Ok(await repo.QueryAsync(query.TrainingCenterPkid, monday, sunday));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<FeaturedPromoItem>> GetById(int id)
    {
        var item = await repo.GetByIdAsync(id);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<FeaturedPromoItem>> Create([FromBody] FeaturedPromoItemRequest request)
    {
        if (await ValidateAsync(request, excludePkid: 0) is { } invalid) return invalid;

        var pkid = await repo.CreateAsync(request);
        var created = await repo.GetByIdAsync(pkid);
        return CreatedAtAction(nameof(GetById), new { id = pkid }, created);
    }

    [HttpPut]
    public async Task<ActionResult<FeaturedPromoItem>> Update([FromBody] FeaturedPromoItemRequest request)
    {
        if (request.Pkid <= 0) return BadRequest(new { message = "pkid is required" });
        if (await repo.GetByIdAsync(request.Pkid) is null) return NotFound();
        if (await ValidateAsync(request, excludePkid: request.Pkid) is { } invalid) return invalid;

        await repo.UpdateAsync(request);
        return Ok(await repo.GetByIdAsync(request.Pkid));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
        => await repo.DeleteAsync(id) ? NoContent() : NotFound();

    /// <summary>"−": slot 2 → 1, swapping with the item already in slot 1.</summary>
    [HttpPost("{id:int}/move-up")]
    public Task<IActionResult> MoveUp(int id) => Move(id, -1);

    /// <summary>"+": slot 1 → 2, swapping with the item already in slot 2.</summary>
    [HttpPost("{id:int}/move-down")]
    public Task<IActionResult> MoveDown(int id) => Move(id, +1);

    private async Task<IActionResult> Move(int id, int delta)
    {
        var item = await repo.GetByIdAsync(id);
        if (item is null) return NotFound();

        var target = item.Slot + delta;
        if (target < 1) return BadRequest(new { message = "已是第一則，無法上移" });
        if (target > FeaturedPromoItem.MaxSlot) return BadRequest(new { message = "已是最後一則，無法下移" });

        return await repo.MoveAsync(id, (byte)target) ? NoContent() : NotFound();
    }

    private async Task<ActionResult?> ValidateAsync(FeaturedPromoItemRequest r, int excludePkid)
    {
        r.Topic = r.Topic.Trim();
        r.Description = r.Description.Trim();
        if (r.Topic.Length == 0) return BadRequest(new { message = "請輸入主題" });
        if (r.Description.Length == 0) return BadRequest(new { message = "請輸入說明" });

        var check = await repo.CheckReferencesAsync(r.TrainingCenterPkid, r.PromotionPkid);
        if (!check.TrainingCenterExists) return BadRequest(new { message = $"訓練中心 {r.TrainingCenterPkid} 不存在" });
        if (!check.PromotionExists) return BadRequest(new { message = $"促銷活動 {r.PromotionPkid} 不存在" });

        var date = r.ScheduleOn!.Value;
        if (await repo.SlotTakenAsync(date, r.TrainingCenterPkid, r.Slot, excludePkid))
            return Conflict(new { message = $"{date:yyyy-MM-dd} 第 {r.Slot} 則已有上稿" });
        return null;
    }
}
