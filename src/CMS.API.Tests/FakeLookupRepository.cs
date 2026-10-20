using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests;

/// <summary>In-memory ILookupRepository so lookup endpoint tests run without SQL Server.</summary>
public class FakeLookupRepository(
    FakePublishStatusRepository publishStatuses, FakePartnerRepository partners, FakeCourseGroupRepository courseGroups,
    FakeCourseRepository courses)
    : ILookupRepository
{
    public Task<IEnumerable<AppUserLookup>> GetAppUsersAsync()
        => Task.FromResult<IEnumerable<AppUserLookup>>(
        [
            new() { Pkid = 1, UserId = "alice", UserName = "Alice" },
            new() { Pkid = 2, UserId = "bob", UserName = "Bob" },
        ]);

    public Task<IEnumerable<AppRoleLookup>> GetAppRolesAsync()
        => Task.FromResult<IEnumerable<AppRoleLookup>>(
            FakeAppUserRepository.Roles.OrderBy(r => r.RoleId, StringComparer.Ordinal).ToList());

    public async Task<IEnumerable<PublishStatusLookup>> GetPublishStatusesAsync()
        => (await publishStatuses.GetAllAsync())
            .Select(s => new PublishStatusLookup { Pkid = s.Pkid, Description = s.Description })
            .ToList();

    public async Task<IEnumerable<PartnerLookup>> GetPartnersAsync()
        => (await partners.GetAllAsync())
            .OrderBy(p => p.DisplayOrder).ThenBy(p => p.Name, StringComparer.Ordinal)
            .Select(p => new PartnerLookup { Pkid = p.Pkid, Name = p.Name })
            .ToList();

    public async Task<IEnumerable<CourseGroupLookup>> GetCourseGroupsAsync()
        => (await courseGroups.GetAllAsync())
            .OrderBy(g => g.Description, StringComparer.Ordinal)
            .Select(g => new CourseGroupLookup { Pkid = g.Pkid, Description = g.Description })
            .ToList();

    public Task<IEnumerable<CertificationLookup>> GetCertificationsAsync()
        => Task.FromResult<IEnumerable<CertificationLookup>>(FakeCourseRepository.Certifications.ToList());

    public Task<IEnumerable<JobCategoryLookup>> GetJobCategoriesAsync()
        => Task.FromResult<IEnumerable<JobCategoryLookup>>(
            FakeCourseRepository.JobCategories.OrderBy(j => j.Description, StringComparer.Ordinal).ToList());

    public async Task<IEnumerable<CourseLookup>> GetCoursesAsync()
        => (await courses.GetAllAsync())
            .OrderBy(c => c.CourseId, StringComparer.Ordinal)
            .Select(c => new CourseLookup { Pkid = c.Pkid, CourseId = c.CourseId, Title = c.Title })
            .ToList();

    public Task<IEnumerable<TrainingCenterLookup>> GetTrainingCentersAsync()
        => Task.FromResult<IEnumerable<TrainingCenterLookup>>(FakeFeaturedPromoItemRepository.TrainingCenters.ToList());

    public Task<IEnumerable<PromotionLookup>> SearchPromotionsAsync(string? keyword, int take)
    {
        var kw = keyword?.Trim() ?? "";
        return Task.FromResult<IEnumerable<PromotionLookup>>(FakeFeaturedPromoItemRepository.Promotions
            .Where(p => kw.Length == 0 || p.PromoCode.Contains(kw, StringComparison.OrdinalIgnoreCase))
            .OrderBy(p => string.Equals(p.PromoCode, kw, StringComparison.OrdinalIgnoreCase) ? 0 : 1)
            .ThenByDescending(p => p.Pkid)
            .Take(take)
            .ToList());
    }
}
