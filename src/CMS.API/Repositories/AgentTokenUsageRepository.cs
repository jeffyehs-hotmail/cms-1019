using System.Text;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class AgentTokenUsageRepository(IDbConnectionFactory db) : IAgentTokenUsageRepository
{
    public async Task<string?> GetUserIdByAgentTokenHashAsync(string tokenHash)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<string?>(
            "SELECT UserId FROM AppUser WHERE AgentTokenHash = @tokenHash AND IsActive = 1", new { tokenHash });
    }

    public async Task<string?> GetSessionOwnerAsync(string sessionId)
    {
        using var conn = await db.OpenAsync();
        return await conn.ExecuteScalarAsync<string?>(
            "SELECT TOP 1 UserId FROM AgentTokenUsage WHERE SessionId = @sessionId", new { sessionId });
    }

    public async Task<IReadOnlyList<AgentModelPrice>> GetPricesAsync(IEnumerable<string> models)
    {
        var list = models.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (list.Count == 0) return [];

        using var conn = await db.OpenAsync();
        return (await conn.QueryAsync<AgentModelPrice>("""
            SELECT Model, EffectiveFrom, InputPerMTok, OutputPerMTok, CacheWrite5mPerMTok, CacheWrite1hPerMTok, CacheReadPerMTok
            FROM AgentModelPrice
            WHERE Model IN @list
            """, new { list })).ToList();
    }

    public async Task ReplaceSessionAsync(AgentTokenUsageReport report, string userId, DateTime updatedTime)
    {
        using var conn = await db.OpenAsync();
        using var tx = conn.BeginTransaction();

        await conn.ExecuteAsync("DELETE FROM AgentTokenUsage WHERE SessionId = @SessionId", new { report.SessionId }, tx);

        var rows = report.Rows.Select(r => new
        {
            report.SessionId,
            report.SessionName,
            UsageDate = r.UsageDate!.Value,
            r.Model,
            UserId = userId,
            report.Project,
            r.InputTokens,
            r.OutputTokens,
            r.CacheWrite5mTokens,
            r.CacheWrite1hTokens,
            r.CacheReadTokens,
            r.Cost,
            report.ParserVersion,
            UpdatedTime = updatedTime,
        }).ToList();

        await conn.ExecuteAsync("""
            INSERT INTO AgentTokenUsage (SessionId, SessionName, UsageDate, Model, UserId, Project,
                InputTokens, OutputTokens, CacheWrite5mTokens, CacheWrite1hTokens, CacheReadTokens,
                Cost, ParserVersion, UpdatedTime)
            VALUES (@SessionId, @SessionName, @UsageDate, @Model, @UserId, @Project,
                @InputTokens, @OutputTokens, @CacheWrite5mTokens, @CacheWrite1hTokens, @CacheReadTokens,
                @Cost, @ParserVersion, @UpdatedTime)
            """, rows, tx);

        tx.Commit();
    }

    public async Task<IEnumerable<AgentTokenUsage>> QueryAsync(AgentTokenUsageQuery query)
    {
        // 依工作階段: also group by SessionId (SessionName is the same on every row of a session).
        var sessionColumns = query.GroupBySession ? "a.SessionId, MAX(a.SessionName) AS SessionName," : "";
        var sessionGroup = query.GroupBySession ? ", a.SessionId" : "";
        var sessionOrder = query.GroupBySession ? ", MAX(a.SessionName), a.SessionId" : "";

        var sql = new StringBuilder($"""
            SELECT a.UsageDate, a.UserId, u.UserName, a.Project, a.Model, {sessionColumns}
                   COUNT(DISTINCT a.SessionId) AS SessionCount,
                   SUM(a.InputTokens) AS InputTokens, SUM(a.OutputTokens) AS OutputTokens,
                   SUM(a.CacheWrite5mTokens) AS CacheWrite5mTokens, SUM(a.CacheWrite1hTokens) AS CacheWrite1hTokens,
                   SUM(a.CacheReadTokens) AS CacheReadTokens,
                   SUM(a.Cost) AS Cost,
                   CAST(MAX(CASE WHEN a.Cost IS NULL THEN 1 ELSE 0 END) AS bit) AS HasUnpricedRows
            FROM AgentTokenUsage a
            JOIN AppUser u ON u.UserId = a.UserId
            WHERE a.UsageDate BETWEEN @From AND @To
            """);
        var p = new DynamicParameters();
        p.Add("From", query.From!.Value);
        p.Add("To", query.To!.Value);

        if (query.UserIds.Count > 0)
        {
            sql.Append(" AND a.UserId IN @UserIds");
            p.Add("UserIds", query.UserIds);
        }
        if (query.Projects.Count > 0)
        {
            sql.Append(" AND a.Project IN @Projects");
            p.Add("Projects", query.Projects);
        }
        if (query.Models.Count > 0)
        {
            sql.Append(" AND a.Model IN @Models");
            p.Add("Models", query.Models);
        }

        sql.Append($"""
             GROUP BY a.UsageDate, a.UserId, u.UserName, a.Project{sessionGroup}, a.Model
             ORDER BY a.UsageDate DESC, a.UserId, a.Project{sessionOrder}, a.Model
            """);

        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<AgentTokenUsage>(sql.ToString(), p);
    }

    public async Task<AgentTokenUsageFilterOptions> GetFilterOptionsAsync()
    {
        using var conn = await db.OpenAsync();
        using var grid = await conn.QueryMultipleAsync("""
            SELECT DISTINCT Project FROM AgentTokenUsage ORDER BY Project;
            SELECT DISTINCT Model FROM AgentTokenUsage ORDER BY Model;
            """);
        return new AgentTokenUsageFilterOptions
        {
            Projects = (await grid.ReadAsync<string>()).ToList(),
            Models = (await grid.ReadAsync<string>()).ToList(),
        };
    }
}
