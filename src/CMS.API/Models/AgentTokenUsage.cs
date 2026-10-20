namespace CMS.API.Models;

/// <summary>Report row (Token 用量): AgentTokenUsage summed per (date, user, project, model).</summary>
public class AgentTokenUsage
{
    public DateOnly UsageDate { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string Project { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public int SessionCount { get; set; }
    public long InputTokens { get; set; }
    public long OutputTokens { get; set; }
    public long CacheWrite5mTokens { get; set; }
    public long CacheWrite1hTokens { get; set; }
    public long CacheReadTokens { get; set; }

    /// <summary>Sum of the priced rows; null when every row is unpriced.</summary>
    public decimal? Cost { get; set; }

    /// <summary>True when at least one session row has no price (Cost NULL).</summary>
    public bool HasUnpricedRows { get; set; }
}
