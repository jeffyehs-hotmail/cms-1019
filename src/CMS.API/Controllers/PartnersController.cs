using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/partners")]
public class PartnersController(IPartnerRepository repo) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Partner>>> GetAll()
        => Ok(await repo.GetAllAsync());

    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<Partner>>> Query([FromBody] PartnerQuery query)
        => Ok(await repo.QueryAsync(query));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Partner>> GetById(int id)
    {
        var partner = id is > 0 and <= short.MaxValue ? await repo.GetByIdAsync((short)id) : null;
        return partner is null ? NotFound() : Ok(partner);
    }

    [HttpPost]
    public async Task<ActionResult<Partner>> Create([FromBody] PartnerRequest request)
    {
        Normalize(request);
        // AppKey has no UNIQUE constraint in the DB, but the public site keys on it.
        if (await repo.AppKeyExistsAsync(request.AppKey))
            return Conflict(new { message = $"應用代碼 '{request.AppKey}' 已存在" });

        var pkid = await repo.CreateAsync(request);
        var created = await repo.GetByIdAsync(pkid);
        return CreatedAtAction(nameof(GetById), new { id = pkid }, created);
    }

    [HttpPut]
    public async Task<ActionResult<Partner>> Update([FromBody] PartnerRequest request)
    {
        if (request.Pkid <= 0) return BadRequest(new { message = "pkid is required" });
        Normalize(request);
        if (await repo.AppKeyExistsAsync(request.AppKey, request.Pkid))
            return Conflict(new { message = $"應用代碼 '{request.AppKey}' 已存在" });

        if (!await repo.UpdateAsync(request)) return NotFound();
        return Ok(await repo.GetByIdAsync(request.Pkid));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id is <= 0 or > short.MaxValue) return NotFound();
        var p = await repo.GetByIdAsync((short)id);
        if (p is null) return NotFound();

        // Course / Certification / PartnerCourseGroup / Promotion2 FKs are enforced; Seminar has no FK but
        // would be orphaned. Refuse up front instead of surfacing a SQL error.
        if (p.CourseCount + p.CertificationCount + p.PartnerCourseGroupCount + p.Promotion2Count + p.SeminarCount > 0)
            return Conflict(new
            {
                message = $"原廠「{p.Name}」使用中（課程 {p.CourseCount} 筆、認證 {p.CertificationCount} 筆、" +
                          $"原廠課程群組 {p.PartnerCourseGroupCount} 筆、推廣項目 {p.Promotion2Count} 筆、" +
                          $"講座 {p.SeminarCount} 筆），無法刪除"
            });

        return await repo.DeleteAsync((short)id) ? NoContent() : NotFound();
    }

    private static void Normalize(PartnerRequest r)
    {
        r.Name = r.Name.Trim();
        r.AppKey = r.AppKey.Trim();
        r.NameOnPartnerMenu = r.NameOnPartnerMenu.Trim();
        r.NameOnCourseDetailPage = r.NameOnCourseDetailPage.Trim();
        r.ImageFilename = string.IsNullOrWhiteSpace(r.ImageFilename) ? null : r.ImageFilename.Trim();
    }
}
