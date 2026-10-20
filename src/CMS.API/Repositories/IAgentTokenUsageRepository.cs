using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IAgentTokenUsageRepository
{
    /// <summary>UserId of the active AppUser whose AgentTokenHash matches, or null.</summary>
    Task<string?> GetUserIdByAgentTokenHashAsync(string tokenHash);

    /// <summary>UserId that already owns rows of the session, or null for a new session.</summary>
    Task<string?> GetSessionOwnerAsync(string sessionId);

    /// <summary>All price rows for the models.</summary>
    Task<IReadOnlyList<AgentModelPrice>> GetPricesAsync(IEnumerable<string> models);

    /// <summary>Deletes the session's rows and inserts the report's rows (Cost already set), in one transaction.</summary>
    Task ReplaceSessionAsync(AgentTokenUsageReport report, string userId, DateTime updatedTime);

    /// <summary>Rows summed per (date, user, project, model); From/To are required here.</summary>
    Task<IEnumerable<AgentTokenUsage>> QueryAsync(AgentTokenUsageQuery query);

    Task<AgentTokenUsageFilterOptions> GetFilterOptionsAsync();
}
