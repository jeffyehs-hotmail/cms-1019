using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public interface ILookupRepository
{
    Task<IEnumerable<AppUserLookup>> GetAppUsersAsync();
}

public class LookupRepository(IDbConnectionFactory db) : ILookupRepository
{
    public async Task<IEnumerable<AppUserLookup>> GetAppUsersAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<AppUserLookup>(
            "SELECT pkid, UserId, UserName FROM AppUser ORDER BY UserName");
    }
}
