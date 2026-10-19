using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/app-roles")]
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

        var pkid = await repo.CreateAsync(request);
        var created = await repo.GetByIdAsync(pkid);
        return CreatedAtAction(nameof(GetById), new { id = pkid }, created);
    }

    [HttpPut]
    public async Task<ActionResult<AppRole>> Update([FromBody] AppRoleRequest request)
    {
        if (request.Pkid <= 0) return BadRequest(new { message = "pkid is required" });
        if (!await repo.UpdateAsync(request)) return NotFound();
        return Ok(await repo.GetByIdAsync(request.Pkid));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
        => await repo.DeleteAsync(id) ? NoContent() : NotFound();
}
