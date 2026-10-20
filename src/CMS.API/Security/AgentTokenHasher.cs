using System.Security.Cryptography;

namespace CMS.API.Security;

/// <summary>
/// Per-user agent tokens for the token-usage hook: <c>cms_at_</c> + 32 random bytes (base64url).
/// Only the SHA-256 hex (same format as PasswordHasher) is stored in AppUser.AgentTokenHash.
/// </summary>
public static class AgentTokenHasher
{
    public const string Prefix = "cms_at_";

    public static string Generate() => Prefix + Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string token) => PasswordHasher.Hash(token);

    /// <summary>The token from an <c>Authorization: Bearer cms_at_...</c> header value, or null.</summary>
    public static string? ReadBearer(string? authorization)
    {
        const string scheme = "Bearer ";
        if (authorization is null || !authorization.StartsWith(scheme, StringComparison.OrdinalIgnoreCase)) return null;
        var token = authorization[scheme.Length..].Trim();
        return token.StartsWith(Prefix, StringComparison.Ordinal) && token.Length > Prefix.Length ? token : null;
    }

    private static string Base64UrlEncode(byte[] bytes)
        => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
