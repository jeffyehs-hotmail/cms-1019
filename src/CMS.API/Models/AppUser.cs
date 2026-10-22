namespace CMS.API.Models;

/// <summary>AppUser response model (使用者). PasswordHash is never exposed.</summary>
public class AppUser
{
    public int Pkid { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; }

    /// <summary>NULL = still on the default password (new or reset); change-password sets it to now (Taipei).</summary>
    public DateTime? PasswordUpdatedTime { get; set; }

    /// <summary>Number of roles assigned via AppUserRole (n-n subquery count).</summary>
    public int RoleCount { get; set; }

    /// <summary>True when an agent token is set (AgentTokenHash itself is never exposed).</summary>
    public bool HasAgentToken { get; set; }

    /// <summary>AgentTokenUsage rows referencing the user (FK); delete is blocked while > 0.</summary>
    public int AgentTokenUsageCount { get; set; }

    /// <summary>Assigned roles; populated on single-record reads only.</summary>
    public List<AppRoleLookup> Roles { get; set; } = [];
}
