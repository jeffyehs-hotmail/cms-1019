using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/app-users")]
public class AppUsersController(IAppUserRepository repo) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AppUser>>> GetAll()
        => Ok(await repo.GetAllAsync());

    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<AppUser>>> Query([FromBody] AppUserQuery query)
        => Ok(await repo.QueryAsync(query));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AppUser>> GetById(int id)
    {
        var user = await repo.GetByIdAsync(id);
        return user is null ? NotFound() : Ok(user);
    }

    [HttpPost]
    public async Task<ActionResult<AppUser>> Create([FromBody] AppUserRequest request)
    {
        Normalize(request);
        if (await ValidateAsync(request) is { } invalid) return invalid;
        if (await repo.UserIdExistsAsync(request.UserId))
            return Conflict(new { message = $"使用者帳號 '{request.UserId}' 已存在" });

        var hash = await DefaultPasswordHashAsync();
        if (hash is null) return MissingDefaultPassword();

        var pkid = await repo.CreateAsync(request, hash);
        var created = await repo.GetByIdAsync(pkid);
        return CreatedAtAction(nameof(GetById), new { id = pkid }, created);
    }

    [HttpPut]
    public async Task<ActionResult<AppUser>> Update([FromBody] AppUserRequest request)
    {
        if (request.Pkid <= 0) return BadRequest(new { message = "pkid is required" });
        Normalize(request);
        if (await ValidateAsync(request) is { } invalid) return invalid;
        if (!await repo.UpdateAsync(request)) return NotFound();
        return Ok(await repo.GetByIdAsync(request.Pkid));
    }

    /// <summary>Resets the password to SysConfig appConfig.defaultPassword.</summary>
    [HttpPost("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id)
    {
        if (await repo.GetByIdAsync(id) is null) return NotFound();

        var hash = await DefaultPasswordHashAsync();
        if (hash is null) return MissingDefaultPassword();

        return await repo.ResetPasswordAsync(id, hash) ? NoContent() : NotFound();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
        => await repo.DeleteAsync(id) ? NoContent() : NotFound();

    private static void Normalize(AppUserRequest r)
    {
        r.UserId = r.UserId.Trim();
        r.UserName = r.UserName.Trim();
        r.RoleIds = r.RoleIds.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private async Task<ActionResult?> ValidateAsync(AppUserRequest r)
    {
        // [Required] runs before trimming, so whitespace-only values are caught here.
        if (r.UserId.Length == 0) return BadRequest(new { message = "請輸入使用者帳號" });
        if (r.UserName.Length == 0) return BadRequest(new { message = "請輸入使用者名稱" });

        var unknown = await repo.CheckRolesAsync(r.RoleIds);
        if (unknown.Count > 0) return BadRequest(new { message = $"角色 {string.Join(", ", unknown)} 不存在" });
        return null;
    }

    private async Task<string?> DefaultPasswordHashAsync()
    {
        var json = await repo.GetSysConfigValueAsync(PasswordHasher.AppConfigKey);
        var password = PasswordHasher.ReadDefaultPassword(json);
        return password is null ? null : PasswordHasher.Hash(password);
    }

    private ObjectResult MissingDefaultPassword()
        => StatusCode(StatusCodes.Status500InternalServerError,
            new { message = "系統設定 appConfig 缺少 defaultPassword" });
}
