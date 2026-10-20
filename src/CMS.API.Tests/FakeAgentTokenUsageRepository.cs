using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests;

/// <summary>In-memory IAgentTokenUsageRepository; agent tokens are resolved against the FakeAppUserRepository.</summary>
public class FakeAgentTokenUsageRepository(FakeAppUserRepository appUsers) : IAgentTokenUsageRepository
{
    private readonly object _lock = new();
    private readonly List<Row> _rows = [];

    /// <summary>AgentModelPrice rows; tests may add or replace them.</summary>
    public List<AgentModelPrice> Prices { get; } =
    [
        new() { Model = "claude-opus-5-5", EffectiveFrom = new DateOnly(2026, 1, 1),
            InputPerMTok = 4m, OutputPerMTok = 20m, CacheWrite5mPerMTok = 5m, CacheWrite1hPerMTok = 8m, CacheReadPerMTok = 0.2m },
        new() { Model = "claude-haiku-5-5", EffectiveFrom = new DateOnly(2026, 1, 1),
            InputPerMTok = 0.1m, OutputPerMTok = 0.5m, CacheWrite5mPerMTok = 0.125m, CacheWrite1hPerMTok = 0.2m, CacheReadPerMTok = 0.01m },
    ];

    /// <summary>A stored AgentTokenUsage row (the table shape, before grouping).</summary>
    public sealed record Row(
        string SessionId, DateOnly UsageDate, string Model, string UserId, string Project,
        long InputTokens, long OutputTokens, long CacheWrite5mTokens, long CacheWrite1hTokens, long CacheReadTokens,
        decimal? Cost, string ParserVersion, DateTime UpdatedTime);

    public IReadOnlyList<Row> Rows
    {
        get { lock (_lock) return _rows.ToList(); }
    }

    public void Add(Row row)
    {
        lock (_lock) _rows.Add(row);
    }

    public Task<string?> GetUserIdByAgentTokenHashAsync(string tokenHash)
        => Task.FromResult(appUsers.FindActiveUserIdByAgentTokenHash(tokenHash));

    public Task<string?> GetSessionOwnerAsync(string sessionId)
    {
        lock (_lock) return Task.FromResult(_rows.FirstOrDefault(r => r.SessionId == sessionId)?.UserId);
    }

    public Task<IReadOnlyList<AgentModelPrice>> GetPricesAsync(IEnumerable<string> models)
    {
        var list = models.ToList();
        return Task.FromResult<IReadOnlyList<AgentModelPrice>>(
            Prices.Where(p => list.Contains(p.Model, StringComparer.OrdinalIgnoreCase)).ToList());
    }

    public Task ReplaceSessionAsync(AgentTokenUsageReport report, string userId, DateTime updatedTime)
    {
        lock (_lock)
        {
            _rows.RemoveAll(r => r.SessionId == report.SessionId);
            _rows.AddRange(report.Rows.Select(r => new Row(
                report.SessionId, r.UsageDate!.Value, r.Model, userId, report.Project,
                r.InputTokens, r.OutputTokens, r.CacheWrite5mTokens, r.CacheWrite1hTokens, r.CacheReadTokens,
                r.Cost, report.ParserVersion, updatedTime)));
        }
        return Task.CompletedTask;
    }

    public async Task<IEnumerable<AgentTokenUsage>> QueryAsync(AgentTokenUsageQuery query)
    {
        var names = (await appUsers.GetAllAsync()).ToDictionary(u => u.UserId, u => u.UserName, StringComparer.OrdinalIgnoreCase);
        lock (_lock)
        {
            IEnumerable<Row> q = _rows.Where(r => r.UsageDate >= query.From!.Value && r.UsageDate <= query.To!.Value);
            if (query.UserIds.Count > 0) q = q.Where(r => query.UserIds.Contains(r.UserId, StringComparer.OrdinalIgnoreCase));
            if (query.Projects.Count > 0) q = q.Where(r => query.Projects.Contains(r.Project, StringComparer.OrdinalIgnoreCase));
            if (query.Models.Count > 0) q = q.Where(r => query.Models.Contains(r.Model, StringComparer.OrdinalIgnoreCase));

            return q.GroupBy(r => (r.UsageDate, r.UserId, r.Project, r.Model))
                .Select(g => new AgentTokenUsage
                {
                    UsageDate = g.Key.UsageDate,
                    UserId = g.Key.UserId,
                    UserName = names.GetValueOrDefault(g.Key.UserId, string.Empty),
                    Project = g.Key.Project,
                    Model = g.Key.Model,
                    SessionCount = g.Select(r => r.SessionId).Distinct().Count(),
                    InputTokens = g.Sum(r => r.InputTokens),
                    OutputTokens = g.Sum(r => r.OutputTokens),
                    CacheWrite5mTokens = g.Sum(r => r.CacheWrite5mTokens),
                    CacheWrite1hTokens = g.Sum(r => r.CacheWrite1hTokens),
                    CacheReadTokens = g.Sum(r => r.CacheReadTokens),
                    Cost = g.Any(r => r.Cost.HasValue) ? g.Sum(r => r.Cost ?? 0) : null,
                    HasUnpricedRows = g.Any(r => r.Cost is null),
                })
                .OrderByDescending(r => r.UsageDate)
                .ThenBy(r => r.UserId, StringComparer.Ordinal)
                .ThenBy(r => r.Project, StringComparer.Ordinal)
                .ThenBy(r => r.Model, StringComparer.Ordinal)
                .ToList();
        }
    }

    public Task<AgentTokenUsageFilterOptions> GetFilterOptionsAsync()
    {
        lock (_lock)
            return Task.FromResult(new AgentTokenUsageFilterOptions
            {
                Projects = _rows.Select(r => r.Project).Distinct().Order(StringComparer.Ordinal).ToList(),
                Models = _rows.Select(r => r.Model).Distinct().Order(StringComparer.Ordinal).ToList(),
            });
    }
}
