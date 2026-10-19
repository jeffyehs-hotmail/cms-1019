using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public interface ILookupRepository
{
    Task<IEnumerable<AppUserLookup>> GetAppUsersAsync();
    Task<IEnumerable<AppRoleLookup>> GetAppRolesAsync();
    Task<IEnumerable<PublishStatusLookup>> GetPublishStatusesAsync();
    Task<IEnumerable<PartnerLookup>> GetPartnersAsync();
    Task<IEnumerable<CourseGroupLookup>> GetCourseGroupsAsync();
    Task<IEnumerable<CertificationLookup>> GetCertificationsAsync();
    Task<IEnumerable<JobCategoryLookup>> GetJobCategoriesAsync();
    Task<IEnumerable<CourseLookup>> GetCoursesAsync();
}

public class LookupRepository(IDbConnectionFactory db) : ILookupRepository
{
    public async Task<IEnumerable<AppUserLookup>> GetAppUsersAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<AppUserLookup>(
            "SELECT pkid, UserId, UserName FROM AppUser ORDER BY UserName");
    }

    public async Task<IEnumerable<AppRoleLookup>> GetAppRolesAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<AppRoleLookup>(
            "SELECT pkid, RoleId, RoleName FROM AppRole ORDER BY RoleId");
    }

    public async Task<IEnumerable<PublishStatusLookup>> GetPublishStatusesAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<PublishStatusLookup>(
            "SELECT pkid, Description FROM PublishStatus ORDER BY pkid");
    }

    public async Task<IEnumerable<PartnerLookup>> GetPartnersAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<PartnerLookup>(
            "SELECT pkid, Name FROM Partner ORDER BY DisplayOrder, Name");
    }

    public async Task<IEnumerable<CourseGroupLookup>> GetCourseGroupsAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<CourseGroupLookup>(
            "SELECT pkid, Description FROM CourseGroup ORDER BY Description");
    }

    public async Task<IEnumerable<CertificationLookup>> GetCertificationsAsync()
    {
        using var conn = await db.OpenAsync();
        // Certification.Title is nchar(100)
        return await conn.QueryAsync<CertificationLookup>("""
            SELECT ce.pkid, RTRIM(ce.Title) AS Title, p.Name AS PartnerName
            FROM Certification ce
            JOIN Partner p ON p.pkid = ce.Partner_pkid
            ORDER BY p.DisplayOrder, p.Name, ce.Title
            """);
    }

    public async Task<IEnumerable<JobCategoryLookup>> GetJobCategoriesAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<JobCategoryLookup>(
            "SELECT pkid, Description FROM JobCategory ORDER BY Description");
    }

    public async Task<IEnumerable<CourseLookup>> GetCoursesAsync()
    {
        using var conn = await db.OpenAsync();
        return await conn.QueryAsync<CourseLookup>(
            "SELECT pkid, CourseId, Title FROM Course ORDER BY CourseId");
    }
}
