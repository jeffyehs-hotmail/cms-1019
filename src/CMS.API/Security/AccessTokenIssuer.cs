using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace CMS.API.Security;

/// <summary>Issues the HS256 JWT access token returned by POST api/auth/login.</summary>
public static class AccessTokenIssuer
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(24);

    /// <summary>HS256 needs a key of at least 256 bits.</summary>
    public const int MinKeyBytes = 32;

    /// <summary>
    /// Extracts <c>symmetricSecurityKey</c> from the appConfig JSON as UTF-8 bytes;
    /// null if missing, blank, shorter than <see cref="MinKeyBytes"/> or not valid JSON.
    /// </summary>
    public static byte[]? ReadSigningKey(string? appConfigJson)
    {
        if (string.IsNullOrWhiteSpace(appConfigJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(appConfigJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("symmetricSecurityKey", out var key)
                && key.ValueKind == JsonValueKind.String)
            {
                var bytes = Encoding.UTF8.GetBytes(key.GetString() ?? string.Empty);
                return bytes.Length >= MinKeyBytes ? bytes : null;
            }
        }
        catch (JsonException)
        {
        }
        return null;
    }

    /// <summary>Claims: <c>sub</c> = UserId, <c>name</c> = UserName, one <c>role</c> per RoleId; expires <see cref="Lifetime"/> after <paramref name="now"/>.</summary>
    public static string Create(string userId, string userName, IEnumerable<string> roleIds, byte[] signingKey, DateTime now)
    {
        var claims = new Dictionary<string, object>
        {
            [JwtRegisteredClaimNames.Sub] = userId,
            [JwtRegisteredClaimNames.Name] = userName,
            [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString("N"),
        };
        var roles = roleIds.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (roles.Length > 0) claims["role"] = roles;

        var descriptor = new SecurityTokenDescriptor
        {
            Claims = claims,
            IssuedAt = now,
            NotBefore = now,
            Expires = now.Add(Lifetime),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(signingKey), SecurityAlgorithms.HmacSha256),
        };
        return new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false }.CreateToken(descriptor);
    }

    /// <summary>Constant-time comparison of two hex hashes, ignoring case.</summary>
    public static bool HashesMatch(string expectedHex, string actualHex)
        => CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(expectedHex.ToLowerInvariant()),
            Encoding.ASCII.GetBytes(actualHex.ToLowerInvariant()));
}
