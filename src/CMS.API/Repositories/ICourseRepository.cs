using CMS.API.Models;

namespace CMS.API.Repositories;

public interface ICourseRepository
{
    Task<IEnumerable<Course>> GetAllAsync();
    Task<IEnumerable<Course>> QueryAsync(CourseQuery query);
    /// <summary>Full record incl. long texts, Certifications and JobCategories.</summary>
    Task<Course?> GetByIdAsync(int pkid);
    /// <summary>True when a course other than <paramref name="excludePkid"/> already uses the CourseId.</summary>
    Task<bool> CourseIdExistsAsync(string courseId, int excludePkid = 0);
    /// <summary>Which FK / n-n ids in the request don't exist.</summary>
    Task<CourseReferenceCheck> CheckReferencesAsync(CourseRequest request);
    Task<int> CreateAsync(CourseRequest request);
    Task<bool> UpdateAsync(CourseRequest request);
    Task<bool> DeleteAsync(int pkid);
}

/// <summary>Result of <see cref="ICourseRepository.CheckReferencesAsync"/>.</summary>
public class CourseReferenceCheck
{
    public bool PartnerExists { get; set; }
    /// <summary>True when CourseGroupPkid is null or exists.</summary>
    public bool CourseGroupExists { get; set; }
    public bool PublishStatusExists { get; set; }
    public List<int> MissingCertificationPkids { get; set; } = [];
    public List<short> MissingJobCategoryPkids { get; set; } = [];
}
