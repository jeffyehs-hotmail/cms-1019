namespace CMS.API.Models;

/// <summary>
/// Ingest payload from the Claude Code SessionEnd hook: the full set of rows for one session.
/// No UserId: the server takes it from the agent token.
/// </summary>
public class AgentTokenUsageReport
{
    public string SessionId { get; set; } = string.Empty;

    /// <summary>Last /rename title, else the last auto title; null/blank = unnamed.</summary>
    public string? SessionName { get; set; }

    public string Project { get; set; } = string.Empty;
    public string ParserVersion { get; set; } = string.Empty;
    public List<AgentTokenUsageReportRow> Rows { get; set; } = [];
}

/// <summary>One (Taipei date, model) total within a session.</summary>
public class AgentTokenUsageReportRow
{
    public DateOnly? UsageDate { get; set; }
    public string Model { get; set; } = string.Empty;
    public long InputTokens { get; set; }
    public long OutputTokens { get; set; }
    public long CacheWrite5mTokens { get; set; }
    public long CacheWrite1hTokens { get; set; }
    public long CacheReadTokens { get; set; }

    /// <summary>Set by the server from AgentModelPrice; null = unpriced model.</summary>
    public decimal? Cost { get; set; }
}
