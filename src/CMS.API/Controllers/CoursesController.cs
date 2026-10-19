using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/courses")]
public class CoursesController(ICourseRepository repo) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Course>>> GetAll()
        => Ok(await repo.GetAllAsync());

    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<Course>>> Query([FromBody] CourseQuery query)
        => Ok(await repo.QueryAsync(query));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Course>> GetById(int id)
    {
        var course = id > 0 ? await repo.GetByIdAsync(id) : null;
        return course is null ? NotFound() : Ok(course);
    }

    [HttpPost]
    public async Task<ActionResult<Course>> Create([FromBody] CourseRequest request)
    {
        Normalize(request);
        if (await ValidateAsync(request) is { } invalid) return invalid;
        // CourseId has no UNIQUE constraint in the DB, but CourseRecomm and the public site key on it.
        if (await repo.CourseIdExistsAsync(request.CourseId))
            return Conflict(new { message = $"簡介代碼 '{request.CourseId}' 已存在" });

        var pkid = await repo.CreateAsync(request);
        var created = await repo.GetByIdAsync(pkid);
        return CreatedAtAction(nameof(GetById), new { id = pkid }, created);
    }

    [HttpPut]
    public async Task<ActionResult<Course>> Update([FromBody] CourseRequest request)
    {
        if (request.Pkid <= 0) return BadRequest(new { message = "pkid is required" });
        Normalize(request);
        if (await ValidateAsync(request) is { } invalid) return invalid;
        if (await repo.CourseIdExistsAsync(request.CourseId, request.Pkid))
            return Conflict(new { message = $"簡介代碼 '{request.CourseId}' 已存在" });

        if (!await repo.UpdateAsync(request)) return NotFound();
        return Ok(await repo.GetByIdAsync(request.Pkid));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id <= 0) return NotFound();
        var c = await repo.GetByIdAsync(id);
        if (c is null) return NotFound();

        // CourseFAQ / CourseRelatedLink / HotCourse FKs don't cascade — refuse up front instead of a SQL error.
        if (c.CourseFaqCount + c.CourseRelatedLinkCount + c.HotCourseCount > 0)
            return Conflict(new
            {
                message = $"課程「{c.CourseId}」使用中（課程問答 {c.CourseFaqCount} 筆、相關連結 {c.CourseRelatedLinkCount} 筆、" +
                          $"熱門課程 {c.HotCourseCount} 筆），無法刪除"
            });

        return await repo.DeleteAsync(id) ? NoContent() : NotFound();
    }

    /// <summary>Rules DataAnnotations can't express; returns a 400 result or null when valid.</summary>
    private async Task<ActionResult?> ValidateAsync(CourseRequest r)
    {
        if (r.ScheduleOff < r.ScheduleOn)
            return BadRequest(new { message = "下架日期不可早於上架日期" });
        if (decimal.Round(r.ListPrice, 0) != r.ListPrice)
            return BadRequest(new { message = "定價須為整數" });
        if (decimal.Round(r.LearningCredit, 1) != r.LearningCredit)
            return BadRequest(new { message = "點數最多一位小數" });

        var check = await repo.CheckReferencesAsync(r);
        if (!check.PartnerExists) return BadRequest(new { message = $"原廠 {r.PartnerPkid} 不存在" });
        if (!check.CourseGroupExists) return BadRequest(new { message = $"課程群組 {r.CourseGroupPkid} 不存在" });
        if (!check.PublishStatusExists) return BadRequest(new { message = $"上架狀態 {r.PublishStatusPkid} 不存在" });
        if (check.MissingCertificationPkids.Count > 0)
            return BadRequest(new { message = $"認證 {string.Join(", ", check.MissingCertificationPkids)} 不存在" });
        if (check.MissingJobCategoryPkids.Count > 0)
            return BadRequest(new { message = $"職務類別 {string.Join(", ", check.MissingJobCategoryPkids)} 不存在" });
        return null;
    }

    private static void Normalize(CourseRequest r)
    {
        r.Title = r.Title.Trim();
        r.CourseId = r.CourseId.Trim();
        r.ProdCourseId = r.ProdCourseId.Trim();
        r.FriendlyUrl = r.FriendlyUrl.Trim();
        r.OfficialTitle = Blank(r.OfficialTitle);
        r.Material = Blank(r.Material);
        r.Objective = Blank(r.Objective);
        r.Target = Blank(r.Target);
        r.Prerequisites = Blank(r.Prerequisites);
        r.Outline = Blank(r.Outline);
        r.TowardCertOrExam = Blank(r.TowardCertOrExam);
        r.Note = Blank(r.Note);
        r.OtherInfo = Blank(r.OtherInfo);
        r.CertificationPkids = r.CertificationPkids.Distinct().ToList();
        r.JobCategoryPkids = r.JobCategoryPkids.Distinct().ToList();
    }

    private static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
