using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

/// <summary>Admin role only (403 otherwise): role membership decides who is Admin.</summary>
[ApiController]
[Route("api/app-roles")]
[Authorize(Roles = AppUsersController.AdminRole)]
public class AppRolesController(IAppRoleRepository repo) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AppRole>>> GetAll()
        => Ok(await repo.GetAllAsync());

    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<AppRole>>> Query([FromBody] AppRoleQuery query)
        => Ok(await repo.QueryAsync(query));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AppRole>> GetById(int id)
    {
        var role = await repo.GetByIdAsync(id);
        return role is null ? NotFound() : Ok(role);
    }

    [HttpPost]
    public async Task<ActionResult<AppRole>> Create([FromBody] AppRoleRequest request)
    {
        request.RoleId = request.RoleId.Trim();
        if (await repo.RoleIdExistsAsync(request.RoleId))
            return Conflict(new { message = $"角色代碼 '{request.RoleId}' 已存在" });
        if (await CheckUsersAsync(request) is { } invalid) return invalid;

        var pkid = await repo.CreateAsync(request);
        var created = await repo.GetByIdAsync(pkid);
        return CreatedAtAction(nameof(GetById), new { id = pkid }, created);
    }

    [HttpPut]
    public async Task<ActionResult<AppRole>> Update([FromBody] AppRoleRequest request)
    {
        if (request.Pkid <= 0) return BadRequest(new { message = "pkid is required" });
        if (await CheckUsersAsync(request) is { } invalid) return invalid;
        if (!await repo.UpdateAsync(request)) return NotFound();
        return Ok(await repo.GetByIdAsync(request.Pkid));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
        => await repo.DeleteAsync(id) ? NoContent() : NotFound();

    /// <summary>
    /// Trims and de-duplicates members (case-insensitive, like the DB, so the AppUserRole PK never sees a repeat),
    /// then rejects ids with no AppUser row, which would otherwise break the FK.
    /// </summary>
    private async Task<BadRequestObjectResult?> CheckUsersAsync(AppRoleRequest r)
    {
        r.UserIds = r.UserIds.Where(u => !string.IsNullOrWhiteSpace(u)).Select(u => u.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var unknown = await repo.CheckUsersAsync(r.UserIds);
        return unknown.Count > 0 ? BadRequest(new { message = $"使用者 {string.Join(", ", unknown)} 不存在" }) : null;
    }
}
