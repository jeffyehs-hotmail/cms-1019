using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/course-groups")]
public class CourseGroupsController(ICourseGroupRepository repo) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<CourseGroup>>> GetAll()
        => Ok(await repo.GetAllAsync());

    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<CourseGroup>>> Query([FromBody] CourseGroupQuery query)
        => Ok(await repo.QueryAsync(query));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CourseGroup>> GetById(int id)
    {
        var group = id is > 0 and <= short.MaxValue ? await repo.GetByIdAsync((short)id) : null;
        return group is null ? NotFound() : Ok(group);
    }

    [HttpPost]
    public async Task<ActionResult<CourseGroup>> Create([FromBody] CourseGroupRequest request)
    {
        request.Description = request.Description.Trim();
        var pkid = await repo.CreateAsync(request);
        var created = await repo.GetByIdAsync(pkid);
        return CreatedAtAction(nameof(GetById), new { id = pkid }, created);
    }

    [HttpPut]
    public async Task<ActionResult<CourseGroup>> Update([FromBody] CourseGroupRequest request)
    {
        if (request.Pkid <= 0) return BadRequest(new { message = "pkid is required" });
        request.Description = request.Description.Trim();

        if (!await repo.UpdateAsync(request)) return NotFound();
        return Ok(await repo.GetByIdAsync(request.Pkid));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id is <= 0 or > short.MaxValue) return NotFound();
        var g = await repo.GetByIdAsync((short)id);
        if (g is null) return NotFound();

        // Course / PartnerCourseGroup FKs are enforced; refuse up front instead of surfacing a SQL error.
        if (g.CourseCount + g.PartnerCourseGroupCount > 0)
            return Conflict(new
            {
                message = $"課程群組「{g.Description}」使用中（課程 {g.CourseCount} 筆、" +
                          $"原廠課程群組 {g.PartnerCourseGroupCount} 筆），無法刪除"
            });

        return await repo.DeleteAsync((short)id) ? NoContent() : NotFound();
    }
}
