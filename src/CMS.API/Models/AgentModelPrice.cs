namespace CMS.API.Models;

/// <summary>USD list price per million tokens for a model, effective from a date.</summary>
public class AgentModelPrice
{
    public string Model { get; set; } = string.Empty;
    public DateOnly EffectiveFrom { get; set; }
    public decimal InputPerMTok { get; set; }
    public decimal OutputPerMTok { get; set; }
    public decimal CacheWrite5mPerMTok { get; set; }
    public decimal CacheWrite1hPerMTok { get; set; }
    public decimal CacheReadPerMTok { get; set; }

    /// <summary>The price with the latest EffectiveFrom on or before the date, or null.</summary>
    public static AgentModelPrice? For(IEnumerable<AgentModelPrice> prices, string model, DateOnly date)
        => prices.Where(p => string.Equals(p.Model, model, StringComparison.OrdinalIgnoreCase) && p.EffectiveFrom <= date)
            .MaxBy(p => p.EffectiveFrom);

    /// <summary>Cost of the row's tokens at this price, rounded to the column scale (6 decimals).</summary>
    public decimal CostOf(AgentTokenUsageReportRow row)
        => Math.Round((row.InputTokens * InputPerMTok
                       + row.OutputTokens * OutputPerMTok
                       + row.CacheWrite5mTokens * CacheWrite5mPerMTok
                       + row.CacheWrite1hTokens * CacheWrite1hPerMTok
                       + row.CacheReadTokens * CacheReadPerMTok) / 1_000_000m, 6);
}
