namespace CMS.API.Models;

/// <summary>A newly issued agent token; shown to the user once and never stored in plain text.</summary>
public class AgentTokenResponse
{
    public string Token { get; set; } = string.Empty;
}
