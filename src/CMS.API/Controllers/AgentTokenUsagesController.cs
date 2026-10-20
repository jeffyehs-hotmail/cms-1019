using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

/// <summary>Claude Code token usage: ingest from the SessionEnd hook, plus the Token 用量 report.</summary>
[ApiController]
[Route("api/agent-token-usages")]
public class AgentTokenUsagesController(IAgentTokenUsageRepository repo, TimeProvider time) : ControllerBase
{
    public const int MaxRows = 500;
    private const string InvalidToken = "Agent Token 無效";

    /// <summary>Taiwan has no DST, so Taipei time is always UTC+8.</summary>
    private static readonly TimeSpan TaipeiOffset = TimeSpan.FromHours(8);

    /// <summary>Replaces all rows of the session. Requires <c>Authorization: Bearer cms_at_...</c>; the user comes from the token.</summary>
    [HttpPost]
    public async Task<IActionResult> Report([FromBody] AgentTokenUsageReport report)
    {
        var token = AgentTokenHasher.ReadBearer(Request.Headers.Authorization.ToString());
        var userId = token is null ? null : await repo.GetUserIdByAgentTokenHashAsync(AgentTokenHasher.Hash(token));
        if (userId is null) return Unauthorized(new { message = InvalidToken });

        Normalize(report);
        if (Validate(report) is { } invalid) return invalid;

        var owner = await repo.GetSessionOwnerAsync(report.SessionId);
        if (owner is not null && !string.Equals(owner, userId, StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = $"工作階段 '{report.SessionId}' 已屬於其他使用者" });

        var prices = await repo.GetPricesAsync(report.Rows.Select(r => r.Model));
        foreach (var row in report.Rows)
            row.Cost = AgentModelPrice.For(prices, row.Model, row.UsageDate!.Value)?.CostOf(row);

        await repo.ReplaceSessionAsync(report, userId, TaipeiNow());
        return NoContent();
    }

    /// <summary>Rows summed per (date, user, project, model). Missing dates default to the current Taipei month.</summary>
    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<AgentTokenUsage>>> Query([FromBody] AgentTokenUsageQuery query)
    {
        var today = DateOnly.FromDateTime(TaipeiNow());
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        query.From ??= monthStart;
        query.To ??= monthStart.AddMonths(1).AddDays(-1);
        if (query.From > query.To) return BadRequest(new { message = "起始日期不可晚於結束日期" });

        query.UserIds = Clean(query.UserIds);
        query.Projects = Clean(query.Projects);
        query.Models = Clean(query.Models);
        return Ok(await repo.QueryAsync(query));
    }

    [HttpGet("filter-options")]
    public async Task<ActionResult<AgentTokenUsageFilterOptions>> GetFilterOptions()
        => Ok(await repo.GetFilterOptionsAsync());

    private DateTime TaipeiNow() => time.GetUtcNow().ToOffset(TaipeiOffset).DateTime;

    private static List<string> Clean(List<string>? values)
        => (values ?? []).Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();

    private static void Normalize(AgentTokenUsageReport r)
    {
        r.SessionId = (r.SessionId ?? string.Empty).Trim();
        r.Project = (r.Project ?? string.Empty).Trim();
        r.ParserVersion = (r.ParserVersion ?? string.Empty).Trim();
        r.Rows ??= [];
        foreach (var row in r.Rows) row.Model = (row.Model ?? string.Empty).Trim();
    }

    private BadRequestObjectResult? Validate(AgentTokenUsageReport r)
    {
        if (r.SessionId.Length is 0 or > 100) return Bad("sessionId 必填且不可超過 100 字");
        if (r.Project.Length is 0 or > 200) return Bad("project 必填且不可超過 200 字");
        if (r.ParserVersion.Length is 0 or > 20) return Bad("parserVersion 必填且不可超過 20 字");
        if (r.Rows.Count is 0 or > MaxRows) return Bad($"rows 須為 1 到 {MaxRows} 筆");

        var today = DateOnly.FromDateTime(TaipeiNow());
        var seen = new HashSet<(DateOnly, string)>();
        foreach (var row in r.Rows)
        {
            if (row.UsageDate is not { } date) return Bad("usageDate 必填");
            if (date > today.AddDays(1) || date < today.AddDays(-400))
                return Bad($"usageDate {date:yyyy-MM-dd} 超出允許範圍");
            if (row.Model.Length is 0 or > 100) return Bad("model 必填且不可超過 100 字");
            if (row.InputTokens < 0 || row.OutputTokens < 0 || row.CacheWrite5mTokens < 0
                || row.CacheWrite1hTokens < 0 || row.CacheReadTokens < 0)
                return Bad("Token 數不可為負數");
            if (row.InputTokens + row.OutputTokens + row.CacheWrite5mTokens + row.CacheWrite1hTokens + row.CacheReadTokens == 0)
                return Bad($"{date:yyyy-MM-dd} {row.Model} 的 Token 數皆為 0");
            if (!seen.Add((date, row.Model.ToLowerInvariant())))
                return Bad($"{date:yyyy-MM-dd} {row.Model} 重複");
        }
        return null;
    }

    private BadRequestObjectResult Bad(string message) => BadRequest(new { message });
}
