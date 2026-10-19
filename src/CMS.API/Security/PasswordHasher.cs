using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace CMS.API.Security;

/// <summary>AppUser.PasswordHash format: lowercase hex SHA-256 of the UTF-8 password (unsalted, matches existing rows).</summary>
public static class PasswordHasher
{
    /// <summary>SysConfig key whose JSON value holds <c>defaultPassword</c>.</summary>
    public const string AppConfigKey = "appConfig";

    public static string Hash(string password)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(password)));

    /// <summary>Extracts <c>defaultPassword</c> from the appConfig JSON; null if missing, blank or not valid JSON.</summary>
    public static string? ReadDefaultPassword(string? appConfigJson)
    {
        if (string.IsNullOrWhiteSpace(appConfigJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(appConfigJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("defaultPassword", out var pwd)
                && pwd.ValueKind == JsonValueKind.String
                && !string.IsNullOrWhiteSpace(pwd.GetString()))
                return pwd.GetString();
        }
        catch (JsonException)
        {
        }
        return null;
    }
}
