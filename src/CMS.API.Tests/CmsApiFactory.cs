using System.Net.Http.Headers;
using System.Text;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CMS.API.Tests;

/// <summary>
/// Hosts CMS.API in-memory with the database-backed repositories swapped for fakes. Clients from CreateClient()
/// (also via WithWebHostBuilder) send a valid login JWT for alice (Admin); tests of anonymous access clear the header.
/// </summary>
public class CmsApiFactory : WebApplicationFactory<Program>
{
    public FakeAppRoleRepository AppRoles { get; } = new();
    public FakeAppUserRepository AppUsers { get; } = new();
    public FakePublishStatusRepository PublishStatuses { get; } = new();
    public FakePartnerRepository Partners { get; } = new();
    public FakeCourseGroupRepository CourseGroups { get; } = new();
    public FakeCourseRepository Courses { get; } = new();
    public FakeFeaturedPromoItemRepository FeaturedPromoItems { get; } = new();
    public FakeAuthRepository Auth { get; } = new();
    public FakeAgentTokenUsageRepository AgentTokenUsages { get; }
    public FakeRowAuditRepository RowAudits { get; } = new();

    public CmsApiFactory() => AgentTokenUsages = new FakeAgentTokenUsageRepository(AppUsers);

    /// <summary>A login JWT signed with the fake SysConfig key, as AuthController would issue it.</summary>
    public static string AccessToken(string userId = "alice", string userName = "Alice", string[]? roles = null, DateTime? now = null)
        => AccessTokenIssuer.Create(userId, userName, roles ?? ["Admin", "User"],
            Encoding.UTF8.GetBytes(FakeAuthRepository.SigningKey), now ?? DateTime.UtcNow);

    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AccessToken());
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IAppRoleRepository>();
            services.AddSingleton<IAppRoleRepository>(AppRoles);
            services.RemoveAll<IAppUserRepository>();
            services.AddSingleton<IAppUserRepository>(AppUsers);
            services.RemoveAll<IPublishStatusRepository>();
            services.AddSingleton<IPublishStatusRepository>(PublishStatuses);
            services.RemoveAll<IPartnerRepository>();
            services.AddSingleton<IPartnerRepository>(Partners);
            services.RemoveAll<ICourseGroupRepository>();
            services.AddSingleton<ICourseGroupRepository>(CourseGroups);
            services.RemoveAll<ICourseRepository>();
            services.AddSingleton<ICourseRepository>(Courses);
            services.RemoveAll<IFeaturedPromoItemRepository>();
            services.AddSingleton<IFeaturedPromoItemRepository>(FeaturedPromoItems);
            services.RemoveAll<IAuthRepository>();
            services.AddSingleton<IAuthRepository>(Auth);
            services.RemoveAll<IAgentTokenUsageRepository>();
            services.AddSingleton<IAgentTokenUsageRepository>(AgentTokenUsages);
            services.RemoveAll<IRowAuditRepository>();
            services.AddSingleton<IRowAuditRepository>(RowAudits);
            services.RemoveAll<ILookupRepository>();
            services.AddSingleton<ILookupRepository>(new FakeLookupRepository(PublishStatuses, Partners, CourseGroups, Courses));
        });
    }
}
