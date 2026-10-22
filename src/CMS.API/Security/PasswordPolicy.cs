namespace CMS.API.Security;

/// <summary>
/// New-password complexity: at least 8 characters and at least 3 of the 4 classes
/// uppercase A-Z / lowercase a-z / digit 0-9 / ASCII symbol. Mirrored by the frontend's <c>password-policy.ts</c>.
/// </summary>
public static class PasswordPolicy
{
    public const int MinLength = 8;

    public const string Message =
        "密碼長度至少需 8 碼，且內容須至少包含四種字元的其中三種：大寫英文／小寫英文／數字／符號"
        + "\n(Password must be at least 8 characters and contain at least 3 of the 4 classes: uppercase / lowercase / digit / symbol.)";

    public static bool IsComplex(string? password)
    {
        if (password is null || password.Length < MinLength) return false;
        var classes = new[]
        {
            password.Any(char.IsAsciiLetterUpper),
            password.Any(char.IsAsciiLetterLower),
            password.Any(char.IsAsciiDigit),
            password.Any(c => char.IsAscii(c) && (char.IsPunctuation(c) || char.IsSymbol(c))),
        };
        return classes.Count(x => x) >= 3;
    }
}
