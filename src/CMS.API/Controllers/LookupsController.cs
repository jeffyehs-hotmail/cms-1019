using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/lookups")]
public class LookupsController(ILookupRepository repo) : ControllerBase
{
    [HttpGet("app-users")]
    public async Task<ActionResult<IEnumerable<AppUserLookup>>> GetAppUsers()
        => Ok(await repo.GetAppUsersAsync());

    [HttpGet("app-roles")]
    public async Task<ActionResult<IEnumerable<AppRoleLookup>>> GetAppRoles()
        => Ok(await repo.GetAppRolesAsync());

    [HttpGet("publish-statuses")]
    public async Task<ActionResult<IEnumerable<PublishStatusLookup>>> GetPublishStatuses()
        => Ok(await repo.GetPublishStatusesAsync());

    [HttpGet("partners")]
    public async Task<ActionResult<IEnumerable<PartnerLookup>>> GetPartners()
        => Ok(await repo.GetPartnersAsync());

    [HttpGet("course-groups")]
    public async Task<ActionResult<IEnumerable<CourseGroupLookup>>> GetCourseGroups()
        => Ok(await repo.GetCourseGroupsAsync());

    [HttpGet("certifications")]
    public async Task<ActionResult<IEnumerable<CertificationLookup>>> GetCertifications()
        => Ok(await repo.GetCertificationsAsync());

    [HttpGet("job-categories")]
    public async Task<ActionResult<IEnumerable<JobCategoryLookup>>> GetJobCategories()
        => Ok(await repo.GetJobCategoriesAsync());

    [HttpGet("training-centers")]
    public async Task<ActionResult<IEnumerable<TrainingCenterLookup>>> GetTrainingCenters()
        => Ok(await repo.GetTrainingCentersAsync());

    /// <summary>PromoCode autocomplete for FeaturedPromoItem (max 20 rows).</summary>
    [HttpGet("promotions")]
    public async Task<ActionResult<IEnumerable<PromotionLookup>>> SearchPromotions([FromQuery] string? keyword)
        => Ok(await repo.SearchPromotionsAsync(keyword, 20));

    [HttpGet("courses")]
    public async Task<ActionResult<IEnumerable<CourseLookup>>> GetCourses()
        => Ok(await repo.GetCoursesAsync());
}
