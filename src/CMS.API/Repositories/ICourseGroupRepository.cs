using CMS.API.Models;

namespace CMS.API.Repositories;

public interface ICourseGroupRepository
{
    Task<IEnumerable<CourseGroup>> GetAllAsync();
    Task<IEnumerable<CourseGroup>> QueryAsync(CourseGroupQuery query);
    Task<CourseGroup?> GetByIdAsync(short pkid);
    Task<short> CreateAsync(CourseGroupRequest request);
    Task<bool> UpdateAsync(CourseGroupRequest request);
    Task<bool> DeleteAsync(short pkid);
}
