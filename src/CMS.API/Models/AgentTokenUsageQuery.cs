namespace CMS.API.Models;

/// <summary>Token 用量 report filters. Missing dates default to the current Taipei month.</summary>
public class AgentTokenUsageQuery
{
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    public List<string> UserIds { get; set; } = [];
    public List<string> Projects { get; set; } = [];
    public List<string> Models { get; set; } = [];

    /// <summary>true = one row per session as well (依工作階段), with SessionId / SessionName filled.</summary>
    public bool GroupBySession { get; set; }
}

/// <summary>Distinct values for the report's project / model filters.</summary>
public class AgentTokenUsageFilterOptions
{
    public List<string> Projects { get; set; } = [];
    public List<string> Models { get; set; } = [];
}
