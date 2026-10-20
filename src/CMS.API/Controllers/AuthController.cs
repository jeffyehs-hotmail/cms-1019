using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthRepository repo, TimeProvider time) : ControllerBase
{
    private const string InvalidCredentials = "帳號或密碼錯誤";

    /// <summary>Checks UserId / IsActive / SHA-256 password and returns the profile with a 24h JWT.</summary>
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var user = await repo.GetLoginUserAsync(request.UserId);
        // The DB collation is case-insensitive and ignores trailing spaces; UserId must match exactly.
        if (user is null
            || !string.Equals(user.UserId, request.UserId, StringComparison.Ordinal)
            || !user.IsActive
            || !AccessTokenIssuer.HashesMatch(user.PasswordHash, PasswordHasher.Hash(request.Password)))
            return Unauthorized(new { message = InvalidCredentials });

        var key = AccessTokenIssuer.ReadSigningKey(await repo.GetSysConfigValueAsync(PasswordHasher.AppConfigKey));
        if (key is null)
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { message = "系統設定 appConfig 缺少有效的 symmetricSecurityKey" });

        var roles = await repo.GetRoleIdsAsync(user.UserId);
        var token = AccessTokenIssuer.Create(user.UserId, user.UserName, roles, key, time.GetUtcNow().UtcDateTime);
        return Ok(new LoginResponse { UserId = user.UserId, UserName = user.UserName, AccessToken = token });
    }
}
