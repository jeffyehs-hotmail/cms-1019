using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CMS.API.Models;
using CMS.API.Security;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CMS.API.Tests;

public class AgentTokenUsagesControllerTests : IDisposable
{
    private const string Url = "/api/agent-token-usages";
    private const string AliceToken = "cms_at_alice-test-token";
    private const string CarolToken = "cms_at_carol-test-token";
    private const string BobToken = "cms_at_bob-inactive-token";

    /// <summary>2026-10-20 10:00 in Taipei.</summary>
    private static readonly DateTimeOffset Now = new(2026, 10, 20, 2, 0, 0, TimeSpan.Zero);

    private readonly CmsApiFactory _factory = new();

    public AgentTokenUsagesControllerTests()
    {
        _factory.AppUsers.SetAgentTokenHashAsync(1, AgentTokenHasher.Hash(AliceToken)).GetAwaiter().GetResult();
        _factory.AppUsers.SetAgentTokenHashAsync(2, AgentTokenHasher.Hash(BobToken)).GetAwaiter().GetResult();   // bob is inactive
        _factory.AppUsers.SetAgentTokenHashAsync(3, AgentTokenHasher.Hash(CarolToken)).GetAwaiter().GetResult();
    }

    public void Dispose() => _factory.Dispose();

    private HttpClient Client(DateTimeOffset? now = null, string? token = AliceToken)
    {
        var client = _factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<TimeProvider>();
            s.AddSingleton<TimeProvider>(new FixedTimeProvider(now ?? Now));
        })).CreateClient();
        if (token is not null) client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static object Row(string date = "2026-10-20", string model = "claude-opus-5-5",
        long input = 1_000_000, long output = 0, long write5m = 0, long write1h = 0, long read = 0)
        => new
        {
            usageDate = date, model, inputTokens = input, outputTokens = output,
            cacheWrite5mTokens = write5m, cacheWrite1hTokens = write1h, cacheReadTokens = read,
        };

    private static object Report(string sessionId = "s1", string project = "cms-1019", params object[] rows)
        => new { sessionId, project, parserVersion = "1", rows = rows.Length == 0 ? [Row()] : rows };

    private static async Task<string?> MessageOf(HttpResponseMessage res)
        => (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString();

    // ---------- Auth ----------

    [Theory]
    [InlineData(null)]
    [InlineData("cms_at_unknown")]
    [InlineData(BobToken)]          // inactive user
    public async Task Report_WithoutValidToken_Returns401(string? token)
    {
        var res = await Client(token: token).PostAsJsonAsync(Url, Report());

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Equal("Agent Token 無效", await MessageOf(res));
        Assert.Empty(_factory.AgentTokenUsages.Rows);
    }

    [Fact]
    public async Task Report_WithNonAgentBearer_Returns401()
    {
        var client = Client(token: null);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "eyJhbGciOiJIUzI1NiJ9.x.y");

        var res = await client.PostAsJsonAsync(Url, Report());

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    // ---------- Ingest ----------

    [Fact]
    public async Task Report_StoresRows_ForTheTokenUser_WithCost()
    {
        var res = await Client().PostAsJsonAsync(Url, Report("s1", " cms-1019 ",
            Row("2026-10-19", input: 1_000_000, output: 1_000_000, write5m: 1_000_000, write1h: 1_000_000, read: 1_000_000),
            Row("2026-10-20", model: "claude-haiku-5-5", input: 2_000_000)));

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        var rows = _factory.AgentTokenUsages.Rows.OrderBy(r => r.UsageDate).ToList();
        Assert.Equal(2, rows.Count);
        Assert.All(rows, r => Assert.Equal("alice", r.UserId));
        Assert.All(rows, r => Assert.Equal("cms-1019", r.Project));
        Assert.Equal(4m + 20m + 5m + 8m + 0.2m, rows[0].Cost);
        Assert.Equal(0.2m, rows[1].Cost);
        Assert.Equal(new DateTime(2026, 10, 20, 10, 0, 0), rows[0].UpdatedTime);  // Taipei time
    }

    [Fact]
    public async Task Report_UnpricedModel_StoresNullCost()
    {
        var res = await Client().PostAsJsonAsync(Url, Report(rows: Row(model: "claude-new-model")));

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.Null(Assert.Single(_factory.AgentTokenUsages.Rows).Cost);
    }

    [Fact]
    public async Task Report_UsesThePriceEffectiveOnTheRowDate()
    {
        _factory.AgentTokenUsages.Prices.Add(new AgentModelPrice
        {
            Model = "claude-opus-5-5", EffectiveFrom = new DateOnly(2026, 10, 20),
            InputPerMTok = 1m, OutputPerMTok = 1m, CacheWrite5mPerMTok = 1m, CacheWrite1hPerMTok = 1m, CacheReadPerMTok = 1m,
        });

        await Client().PostAsJsonAsync(Url, Report(rows: [Row("2026-10-19"), Row("2026-10-20")]));

        var rows = _factory.AgentTokenUsages.Rows.OrderBy(r => r.UsageDate).ToList();
        Assert.Equal([4m, 1m], rows.Select(r => r.Cost));
    }

    [Fact]
    public async Task Report_ResentSession_ReplacesItsRows()
    {
        var client = Client();
        await client.PostAsJsonAsync(Url, Report("s1", rows: [Row("2026-10-19"), Row("2026-10-20")]));
        await client.PostAsJsonAsync(Url, Report("s2", rows: Row("2026-10-20")));

        var res = await client.PostAsJsonAsync(Url, Report("s1", rows: Row("2026-10-20", input: 5)));

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        var s1 = _factory.AgentTokenUsages.Rows.Where(r => r.SessionId == "s1").ToList();
        Assert.Equal(5, Assert.Single(s1).InputTokens);
        Assert.Single(_factory.AgentTokenUsages.Rows, r => r.SessionId == "s2");
    }

    [Theory]
    [InlineData("  token report  ", "token report")]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    public async Task Report_StoresTheTrimmedSessionName(string? sent, string? stored)
    {
        var res = await Client().PostAsJsonAsync(Url,
            new { sessionId = "s1", sessionName = sent, project = "p", parserVersion = "2", rows = new[] { Row() } });

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.Equal(stored, Assert.Single(_factory.AgentTokenUsages.Rows).SessionName);
    }

    [Fact]
    public async Task Report_SessionNameOver200_Returns400()
    {
        var res = await Client().PostAsJsonAsync(Url,
            new { sessionId = "s1", sessionName = new string('n', 201), project = "p", parserVersion = "2", rows = new[] { Row() } });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("sessionName 不可超過 200 字", await MessageOf(res));
    }

    [Fact]
    public async Task Report_SessionOwnedByAnotherUser_Returns409()
    {
        await Client().PostAsJsonAsync(Url, Report("s1"));

        var res = await Client(token: CarolToken).PostAsJsonAsync(Url, Report("s1", rows: Row(input: 9)));

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Contains("s1", await MessageOf(res));
        Assert.Equal(1_000_000, Assert.Single(_factory.AgentTokenUsages.Rows).InputTokens);
    }

    // ---------- Validation ----------

    public static TheoryData<object> InvalidReports => new()
    {
        new { sessionId = " ", project = "p", parserVersion = "1", rows = new[] { Row() } },
        new { sessionId = new string('x', 101), project = "p", parserVersion = "1", rows = new[] { Row() } },
        new { sessionId = "s", project = "", parserVersion = "1", rows = new[] { Row() } },
        new { sessionId = "s", project = new string('p', 201), parserVersion = "1", rows = new[] { Row() } },
        new { sessionId = "s", project = "p", parserVersion = "", rows = new[] { Row() } },
        new { sessionId = "s", project = "p", parserVersion = "1", rows = Array.Empty<object>() },
        new { sessionId = "s", project = "p", parserVersion = "1", rows = Enumerable.Range(0, 501).Select(i => Row(model: $"m{i}")).ToArray() },
        new { sessionId = "s", project = "p", parserVersion = "1", rows = new[] { Row(input: -1) } },
        new { sessionId = "s", project = "p", parserVersion = "1", rows = new[] { Row(input: 0) } },
        new { sessionId = "s", project = "p", parserVersion = "1", rows = new[] { Row(model: " ") } },
        new { sessionId = "s", project = "p", parserVersion = "1", rows = new[] { Row(model: new string('m', 101)) } },
        new { sessionId = "s", project = "p", parserVersion = "1", rows = new[] { Row("2026-10-22") } },   // > today + 1
        new { sessionId = "s", project = "p", parserVersion = "1", rows = new[] { Row("2025-09-14") } },   // < today - 400
        new { sessionId = "s", project = "p", parserVersion = "1", rows = new[] { Row(), Row(model: "CLAUDE-OPUS-5-5") } },
        new { sessionId = "s", project = "p", parserVersion = "1", rows = new object[] { new { model = "m", inputTokens = 1 } } },
    };

    [Theory]
    [MemberData(nameof(InvalidReports))]
    public async Task Report_Invalid_Returns400WithMessage(object report)
    {
        var res = await Client().PostAsJsonAsync(Url, report);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.False(string.IsNullOrEmpty(await MessageOf(res)));
        Assert.Empty(_factory.AgentTokenUsages.Rows);
    }

    [Theory]
    [InlineData("2026-10-21")]   // today + 1
    [InlineData("2025-09-15")]   // today - 400
    public async Task Report_DateRangeEdges_AreAccepted(string date)
    {
        var res = await Client().PostAsJsonAsync(Url, Report(rows: Row(date)));

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
    }

    [Fact]
    public async Task Report_TodayIsTaipeiDate_NotUtc()
    {
        // 2026-10-19 16:30 UTC = 2026-10-20 00:30 Taipei, so 2026-10-21 is still within today + 1.
        var res = await Client(new DateTimeOffset(2026, 10, 19, 16, 30, 0, TimeSpan.Zero))
            .PostAsJsonAsync(Url, Report(rows: Row("2026-10-21")));

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
    }

    // ---------- Report query ----------

    private void Seed(string sessionId, string date, string userId, string project, string model, long input, decimal? cost)
        => _factory.AgentTokenUsages.Add(new FakeAgentTokenUsageRepository.Row(
            sessionId, DateOnly.Parse(date), model, userId, project, input, 1, 2, 3, 4, cost, "1", DateTime.Now));

    private void SeedReport()
    {
        Seed("a1", "2026-10-20", "alice", "cms-1019", "claude-opus-5-5", 10, 1.5m);
        Seed("a2", "2026-10-20", "alice", "cms-1019", "claude-opus-5-5", 20, null);
        Seed("a2", "2026-10-20", "alice", "cms-1019", "claude-haiku-5-5", 5, 0.1m);
        Seed("c1", "2026-10-02", "carol", "other", "claude-opus-5-5", 7, 2m);
        Seed("c2", "2026-09-30", "carol", "other", "claude-opus-5-5", 9, 3m);
    }

    [Fact]
    public async Task Query_DefaultsToCurrentTaipeiMonth_GroupedAndOrdered()
    {
        SeedReport();

        var rows = await (await Client(token: null).PostAsJsonAsync($"{Url}/query", new { }))
            .Content.ReadFromJsonAsync<List<AgentTokenUsage>>();

        Assert.Equal(["claude-haiku-5-5", "claude-opus-5-5", "claude-opus-5-5"], rows!.Select(r => r.Model));
        Assert.Equal(["2026-10-20", "2026-10-20", "2026-10-02"], rows!.Select(r => r.UsageDate.ToString("yyyy-MM-dd")));
        var opus = rows[1];
        Assert.Equal(("alice", "Alice", 2, 30L, 2L, 4L, 6L, 8L), (opus.UserId, opus.UserName, opus.SessionCount,
            opus.InputTokens, opus.OutputTokens, opus.CacheWrite5mTokens, opus.CacheWrite1hTokens, opus.CacheReadTokens));
        Assert.Equal(1.5m, opus.Cost);
        Assert.True(opus.HasUnpricedRows);
        Assert.False(rows[0].HasUnpricedRows);
    }

    [Fact]
    public async Task Query_FiltersByDatesUsersProjectsModels()
    {
        SeedReport();
        var client = Client(token: null);

        async Task<List<AgentTokenUsage>> Q(object body)
            => (await (await client.PostAsJsonAsync($"{Url}/query", body)).Content.ReadFromJsonAsync<List<AgentTokenUsage>>())!;

        Assert.Equal(2, (await Q(new { from = "2026-09-01", to = "2026-10-02" })).Count);
        Assert.Equal(["carol"], (await Q(new { from = "2026-09-01", to = "2026-10-31", userIds = new[] { "carol" } }))
            .Select(r => r.UserId).Distinct());
        Assert.Equal(2, (await Q(new { from = "2026-09-01", to = "2026-10-31", projects = new[] { "other" } })).Count);
        Assert.Single(await Q(new { models = new[] { "claude-haiku-5-5", " " } }));
    }

    [Fact]
    public async Task Query_WithoutGroupBySession_LeavesSessionFieldsEmpty()
    {
        SeedReport();

        var rows = await (await Client(token: null).PostAsJsonAsync($"{Url}/query", new { }))
            .Content.ReadFromJsonAsync<List<AgentTokenUsage>>();

        Assert.All(rows!, r => Assert.Null(r.SessionId));
        Assert.All(rows!, r => Assert.Null(r.SessionName));
    }

    [Fact]
    public async Task Query_GroupBySession_SplitsRowsPerSession_WithNames()
    {
        _factory.AgentTokenUsages.Add(new FakeAgentTokenUsageRepository.Row(
            "a1", new DateOnly(2026, 10, 20), "claude-opus-5-5", "alice", "cms-1019", 10, 1, 0, 0, 0, 1m, "2", DateTime.Now, "Zeta work"));
        _factory.AgentTokenUsages.Add(new FakeAgentTokenUsageRepository.Row(
            "a2", new DateOnly(2026, 10, 20), "claude-opus-5-5", "alice", "cms-1019", 20, 1, 0, 0, 0, 2m, "2", DateTime.Now, "Alpha work"));
        _factory.AgentTokenUsages.Add(new FakeAgentTokenUsageRepository.Row(
            "a3", new DateOnly(2026, 10, 20), "claude-opus-5-5", "alice", "cms-1019", 5, 1, 0, 0, 0, 3m, "2", DateTime.Now));

        var rows = await (await Client(token: null).PostAsJsonAsync($"{Url}/query", new { groupBySession = true }))
            .Content.ReadFromJsonAsync<List<AgentTokenUsage>>();

        // Unnamed sessions sort first (null), then by name.
        Assert.Equal(["a3", "a2", "a1"], rows!.Select(r => r.SessionId));
        Assert.Equal([null, "Alpha work", "Zeta work"], rows.Select(r => r.SessionName));
        Assert.All(rows, r => Assert.Equal(1, r.SessionCount));
        Assert.Equal([5L, 20L, 10L], rows.Select(r => r.InputTokens));
    }

    [Fact]
    public async Task Query_FromAfterTo_Returns400()
    {
        var res = await Client(token: null).PostAsJsonAsync($"{Url}/query", new { from = "2026-10-02", to = "2026-10-01" });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("起始日期不可晚於結束日期", await MessageOf(res));
    }

    [Fact]
    public async Task FilterOptions_ReturnsDistinctProjectsAndModels()
    {
        SeedReport();

        var options = await Client(token: null).GetFromJsonAsync<AgentTokenUsageFilterOptions>($"{Url}/filter-options");

        Assert.Equal(["cms-1019", "other"], options!.Projects);
        Assert.Equal(["claude-haiku-5-5", "claude-opus-5-5"], options.Models);
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
    }
}
