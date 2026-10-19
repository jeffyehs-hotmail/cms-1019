using CMS.API.Security;

namespace CMS.API.Tests;

public class PasswordHasherTests
{
    [Fact]
    public void Hash_IsLowercaseHexSha256OfUtf8()
    {
        // FIPS 180-2 test vector; existing AppUser rows use the same format.
        Assert.Equal("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", PasswordHasher.Hash("abc"));
        Assert.Equal("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", PasswordHasher.Hash(""));
    }

    [Fact]
    public void ReadDefaultPassword_ExtractsProperty()
    {
        const string json = """
            {
              "defaultPassword": "S3cret#1",
              "symmetricSecurityKey":"x",
              "enforcePasswordPolicy": true
            }
            """;
        Assert.Equal("S3cret#1", PasswordHasher.ReadDefaultPassword(json));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("[]")]
    [InlineData("""{ "other": 1 }""")]
    [InlineData("""{ "defaultPassword": "  " }""")]
    [InlineData("""{ "defaultPassword": 123 }""")]
    public void ReadDefaultPassword_ReturnsNull_WhenMissingOrInvalid(string? json)
        => Assert.Null(PasswordHasher.ReadDefaultPassword(json));
}
