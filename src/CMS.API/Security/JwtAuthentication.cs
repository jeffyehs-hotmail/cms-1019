using CMS.API.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace CMS.API.Security;

/// <summary>
/// JWT bearer validation for the tokens issued by <see cref="AccessTokenIssuer"/>. Like the issuer, the signing key
/// is read from <c>SysConfig[appConfig].symmetricSecurityKey</c> per request, so a key change takes effect at once.
/// </summary>
public static class JwtAuthentication
{
    public const string Unauthenticated = "請先登入";
    public const string Forbidden = "權限不足，無法執行此操作";
    private const string SigningKeyItem = "CMS.JwtSigningKey";

    public static IServiceCollection AddCmsJwtAuthentication(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IHttpContextAccessor>((options, accessor) =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateIssuerSigningKey = true,
                    ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                    NameClaimType = "name",
                    RoleClaimType = "role",
                    ClockSkew = TimeSpan.FromMinutes(1),
                    // The key was loaded asynchronously in OnMessageReceived; no key (bad appConfig) fails validation.
                    IssuerSigningKeyResolver = (_, _, _, _) =>
                        accessor.HttpContext?.Items[SigningKeyItem] is byte[] key ? [new SymmetricSecurityKey(key)] : [],
                };
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = async context =>
                    {
                        var authorization = context.Request.Headers.Authorization.ToString();
                        if (authorization.Length == 0) return;
                        // Agent tokens (cms_at_...) are checked by AgentTokenUsagesController itself.
                        if (AgentTokenHasher.ReadBearer(authorization) is not null)
                        {
                            context.NoResult();
                            return;
                        }
                        var repo = context.HttpContext.RequestServices.GetRequiredService<IAuthRepository>();
                        if (AccessTokenIssuer.ReadSigningKey(await repo.GetSysConfigValueAsync(PasswordHasher.AppConfigKey)) is { } key)
                            context.HttpContext.Items[SigningKeyItem] = key;
                    },
                    // Same { message } shape as the other 401s, so the frontend can toast it.
                    OnChallenge = async context =>
                    {
                        context.HandleResponse();
                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        context.Response.Headers.WWWAuthenticate = JwtBearerDefaults.AuthenticationScheme;
                        await context.Response.WriteAsJsonAsync(new { message = Unauthenticated });
                    },
                    // Signed in but missing the required role (e.g. Admin-only actions).
                    OnForbidden = async context =>
                    {
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        await context.Response.WriteAsJsonAsync(new { message = Forbidden });
                    },
                };
            });
        return services;
    }
}
