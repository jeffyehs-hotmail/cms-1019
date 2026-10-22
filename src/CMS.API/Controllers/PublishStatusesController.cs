using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

/// <summary>Admin role only (403 otherwise): the screen sits in the adminOnly 系統管理 menu. Lookups stay open.</summary>
[ApiController]
[Route("api/publish-statuses")]
[Authorize(Roles = AppUsersController.AdminRole)]
public class PublishStatusesController(IPublishStatusRepository repo) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PublishStatus>>> GetAll()
        => Ok(await repo.GetAllAsync());

    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<PublishStatus>>> Query([FromBody] PublishStatusQuery query)
        => Ok(await repo.QueryAsync(query));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PublishStatus>> GetById(int id)
    {
        var status = id is >= 0 and <= byte.MaxValue ? await repo.GetByIdAsync((byte)id) : null;
        return status is null ? NotFound() : Ok(status);
    }

    [HttpPost]
    public async Task<ActionResult<PublishStatus>> Create([FromBody] PublishStatusRequest request)
    {
        // pkid is user-supplied (not IDENTITY), so duplicates are possible.
        if (await repo.ExistsAsync(request.Pkid))
            return Conflict(new { message = $"主代碼 {request.Pkid} 已存在" });

        request.Description = request.Description.Trim();
        await repo.CreateAsync(request);
        var created = await repo.GetByIdAsync(request.Pkid);
        return CreatedAtAction(nameof(GetById), new { id = request.Pkid }, created);
    }

    [HttpPut]
    public async Task<ActionResult<PublishStatus>> Update([FromBody] PublishStatusRequest request)
    {
        request.Description = request.Description.Trim();
        if (!await repo.UpdateAsync(request)) return NotFound();
        return Ok(await repo.GetByIdAsync(request.Pkid));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id is < 0 or > byte.MaxValue) return NotFound();
        var status = await repo.GetByIdAsync((byte)id);
        if (status is null) return NotFound();

        // Course / Promotion2 FKs are enforced — refuse up front instead of surfacing a SQL error.
        if (status.CourseCount + status.Promotion2Count > 0)
            return Conflict(new
            {
                message = $"發布狀態「{status.Description}」使用中（課程 {status.CourseCount} 筆、推廣項目 {status.Promotion2Count} 筆），無法刪除"
            });

        return await repo.DeleteAsync((byte)id) ? NoContent() : NotFound();
    }
}
