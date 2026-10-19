using CMS.API.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CMS.API.Tests;

/// <summary>Hosts CMS.API in-memory with the database-backed repositories swapped for fakes.</summary>
public class CmsApiFactory : WebApplicationFactory<Program>
{
    public FakeAppRoleRepository AppRoles { get; } = new();
    public FakeAppUserRepository AppUsers { get; } = new();
    public FakePublishStatusRepository PublishStatuses { get; } = new();
    public FakePartnerRepository Partners { get; } = new();
    public FakeCourseGroupRepository CourseGroups { get; } = new();
    public FakeCourseRepository Courses { get; } = new();

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
            services.RemoveAll<ILookupRepository>();
            services.AddSingleton<ILookupRepository>(new FakeLookupRepository(PublishStatuses, Partners, CourseGroups, Courses));
        });
    }
}
