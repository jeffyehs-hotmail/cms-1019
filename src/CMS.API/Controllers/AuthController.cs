using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.JsonWebTokens;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthRepository repo, TimeProvider time) : ControllerBase
{
    private const string InvalidCredentials = "帳號或密碼錯誤";
    private const string ProfileNotFound = "找不到目前登入的使用者";
    private static readonly TimeSpan TaipeiOffset = TimeSpan.FromHours(8);

    /// <summary>Checks UserId / IsActive / SHA-256 password and returns the profile with a 24h JWT.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
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

    /// <summary>The signed-in user's profile (UserId from the JWT <c>sub</c> claim) with role names.</summary>
    [HttpGet("profile")]
    public async Task<ActionResult<UserProfile>> GetProfile()
    {
        var profile = await repo.GetProfileAsync(CurrentUserId());
        return profile is null ? NotFound(new { message = ProfileNotFound }) : Ok(profile);
    }

    /// <summary>
    /// Updates only the signed-in user's UserName. The UserId is always the JWT <c>sub</c> claim;
    /// UserId and roles cannot be changed here.
    /// </summary>
    [HttpPut("profile")]
    public async Task<ActionResult<UserProfile>> UpdateProfile([FromBody] UserProfileRequest request)
    {
        var userName = request.UserName.Trim();
        if (userName.Length == 0) return BadRequest(new { message = "請輸入使用者名稱" });

        var userId = CurrentUserId();
        if (!await repo.UpdateUserNameAsync(userId, userName)) return NotFound(new { message = ProfileNotFound });
        return Ok(await repo.GetProfileAsync(userId));
    }

    /// <summary>
    /// Changes the signed-in user's own password (UserId from the JWT <c>sub</c> claim): checks the current
    /// password, the complexity rule and the confirmation, then stores SHA-256(new) and PasswordUpdatedTime = now
    /// (Taipei time). Failures are 400 <c>{ message }</c>, never 401, so the frontend keeps the session.
    /// </summary>
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = CurrentUserId();
        var user = await repo.GetLoginUserAsync(userId);
        if (user is null || !string.Equals(user.UserId, userId, StringComparison.Ordinal))
            return NotFound(new { message = ProfileNotFound });

        if (!AccessTokenIssuer.HashesMatch(user.PasswordHash, PasswordHasher.Hash(request.CurrentPassword)))
            return BadRequest(new { message = "目前密碼錯誤" });
        if (!PasswordPolicy.IsComplex(request.NewPassword))
            return BadRequest(new { message = PasswordPolicy.Message });
        if (!string.Equals(request.NewPassword, request.ConfirmPassword, StringComparison.Ordinal))
            return BadRequest(new { message = "新密碼與確認新密碼不一致" });

        var now = time.GetUtcNow().ToOffset(TaipeiOffset).DateTime;
        if (!await repo.UpdatePasswordAsync(userId, PasswordHasher.Hash(request.NewPassword), now))
            return NotFound(new { message = ProfileNotFound });
        return NoContent();
    }

    // Global RequireAuthorization guarantees a validated token, which AccessTokenIssuer always gives a sub.
    private string CurrentUserId() => User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value;
}
