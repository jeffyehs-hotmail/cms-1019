using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IPartnerRepository
{
    Task<IEnumerable<Partner>> GetAllAsync();
    Task<IEnumerable<Partner>> QueryAsync(PartnerQuery query);
    Task<Partner?> GetByIdAsync(short pkid);
    /// <summary>True when a partner other than <paramref name="excludePkid"/> already uses the AppKey.</summary>
    Task<bool> AppKeyExistsAsync(string appKey, short excludePkid = 0);
    Task<short> CreateAsync(PartnerRequest request);
    Task<bool> UpdateAsync(PartnerRequest request);
    Task<bool> DeleteAsync(short pkid);
}
