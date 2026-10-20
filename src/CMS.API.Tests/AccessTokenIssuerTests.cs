using System.Text;
using CMS.API.Security;
using Microsoft.IdentityModel.JsonWebTokens;

namespace CMS.API.Tests;

public class AccessTokenIssuerTests
{
    private const string Key = "0123456789abcdef0123456789abcdef"; // exactly 32 bytes

    [Fact]
    public void ReadSigningKey_ExtractsPropertyAsUtf8()
        => Assert.Equal(Encoding.UTF8.GetBytes(Key),
            AccessTokenIssuer.ReadSigningKey($$"""{ "defaultPassword": "x", "symmetricSecurityKey": "{{Key}}" }"""));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("[]")]
    [InlineData("""{ "symmetricSecurityKey": 123 }""")]
    [InlineData("""{ "symmetricSecurityKey": "0123456789abcdef0123456789abcde" }""")] // 31 bytes
    [InlineData("{ broken")]
    public void ReadSigningKey_ReturnsNullWhenUnusable(string? json)
        => Assert.Null(AccessTokenIssuer.ReadSigningKey(json));

    [Fact]
    public void Create_SetsClaimsAndLifetime_DeduplicatingRoles()
    {
        var now = new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc);
        var jwt = new JsonWebToken(AccessTokenIssuer.Create("u1", "使用者", ["Admin", "admin", "User"], Encoding.UTF8.GetBytes(Key), now));

        Assert.Equal("u1", jwt.Subject);
        Assert.Equal("使用者", jwt.GetClaim("name").Value);
        Assert.Equal(["Admin", "User"], jwt.Claims.Where(c => c.Type == "role").Select(c => c.Value));
        Assert.Equal(now, jwt.IssuedAt);
        Assert.Equal(now, jwt.ValidFrom);
        Assert.Equal(now.AddHours(24), jwt.ValidTo);
    }

    [Theory]
    [InlineData("abc123", "ABC123", true)]
    [InlineData("abc123", "abc124", false)]
    [InlineData("abc123", "abc12", false)]
    public void HashesMatch_IgnoresHexCaseOnly(string a, string b, bool expected)
        => Assert.Equal(expected, AccessTokenIssuer.HashesMatch(a, b));
}
