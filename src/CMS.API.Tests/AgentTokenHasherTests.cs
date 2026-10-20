using CMS.API.Models;
using CMS.API.Security;

namespace CMS.API.Tests;

public class AgentTokenHasherTests
{
    [Fact]
    public void Generate_IsPrefixedBase64Url_AndUnique()
    {
        var a = AgentTokenHasher.Generate();
        var b = AgentTokenHasher.Generate();

        Assert.Matches("^cms_at_[A-Za-z0-9_-]{43}$", a);
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void Hash_IsLowercaseHexSha256()
        => Assert.Matches("^[0-9a-f]{64}$", AgentTokenHasher.Hash("cms_at_x"));

    [Theory]
    [InlineData("Bearer cms_at_abc", "cms_at_abc")]
    [InlineData("bearer  cms_at_abc ", "cms_at_abc")]
    [InlineData("Bearer eyJhbGci", null)]
    [InlineData("Bearer cms_at_", null)]
    [InlineData("Basic cms_at_abc", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void ReadBearer(string? header, string? expected)
        => Assert.Equal(expected, AgentTokenHasher.ReadBearer(header));

    [Fact]
    public void Price_For_PicksLatestEffectiveOnOrBeforeDate()
    {
        AgentModelPrice P(string model, int month, decimal input) => new()
            { Model = model, EffectiveFrom = new DateOnly(2026, month, 1), InputPerMTok = input };
        var prices = new[] { P("m", 1, 1m), P("m", 6, 2m), P("other", 1, 9m) };

        Assert.Null(AgentModelPrice.For(prices, "m", new DateOnly(2025, 12, 31)));
        Assert.Equal(1m, AgentModelPrice.For(prices, "M", new DateOnly(2026, 5, 31))!.InputPerMTok);
        Assert.Equal(2m, AgentModelPrice.For(prices, "m", new DateOnly(2026, 6, 1))!.InputPerMTok);
        Assert.Null(AgentModelPrice.For(prices, "unknown", new DateOnly(2026, 6, 1)));
    }

    [Fact]
    public void Price_CostOf_SumsEachTokenTypeAtItsRate_RoundedTo6Decimals()
    {
        var price = new AgentModelPrice
        {
            InputPerMTok = 4m, OutputPerMTok = 20m, CacheWrite5mPerMTok = 5m, CacheWrite1hPerMTok = 8m, CacheReadPerMTok = 0.2m,
        };
        var row = new AgentTokenUsageReportRow
        {
            InputTokens = 2, OutputTokens = 343, CacheWrite5mTokens = 0, CacheWrite1hTokens = 20445, CacheReadTokens = 33922,
        };

        // (2*4 + 343*20 + 20445*8 + 33922*0.2) / 1e6 = 0.1772124 → 0.177212
        Assert.Equal(0.177212m, price.CostOf(row));
    }
}
