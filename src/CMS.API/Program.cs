using CMS.API.Data;
using CMS.API.Repositories;
using Dapper;

var builder = WebApplication.CreateBuilder(args);

// Dapper type handlers for DateOnly / TimeOnly columns
SqlMapper.AddTypeHandler(new DateOnlyTypeHandler());
SqlMapper.AddTypeHandler(new TimeOnlyTypeHandler());

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "CMS API", Version = "v1" });
});

const string LocalhostCors = "Localhost";
builder.Services.AddCors(options =>
{
    options.AddPolicy(LocalhostCors, policy => policy
        .SetIsOriginAllowed(origin => Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.IsLoopback)
        .AllowAnyHeader()
        .AllowAnyMethod());
});

builder.Services.AddSingleton<IDbConnectionFactory>(_ =>
    new SqlConnectionFactory(builder.Configuration.GetConnectionString("CMS")
        ?? throw new InvalidOperationException("Connection string 'CMS' not found.")));

builder.Services.AddScoped<IAppRoleRepository, AppRoleRepository>();
builder.Services.AddScoped<IAppUserRepository, AppUserRepository>();
builder.Services.AddScoped<IPublishStatusRepository, PublishStatusRepository>();
builder.Services.AddScoped<IPartnerRepository, PartnerRepository>();
builder.Services.AddScoped<ICourseGroupRepository, CourseGroupRepository>();
builder.Services.AddScoped<ICourseRepository, CourseRepository>();
builder.Services.AddScoped<ILookupRepository, LookupRepository>();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "CMS API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors(LocalhostCors);
app.UseAuthorization();
app.MapControllers();

app.Run();

// Exposed for WebApplicationFactory in CMS.API.Tests
public partial class Program { }
