using CMS.API.Data;
using CMS.API.Middleware;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.OpenApi.Models;
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
    // Lets Swagger UI send the login token (Authorize button) to the protected endpoints.
    var bearer = new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" },
    };
    c.AddSecurityDefinition("Bearer", bearer);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement { [bearer] = [] });
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
builder.Services.AddScoped<IFeaturedPromoItemRepository, FeaturedPromoItemRepository>();
builder.Services.AddScoped<ILookupRepository, LookupRepository>();
builder.Services.AddScoped<IAuthRepository, AuthRepository>();
builder.Services.AddScoped<IAgentTokenUsageRepository, AgentTokenUsageRepository>();
builder.Services.AddScoped<IRowAuditRepository, RowAuditRepository>();
builder.Services.AddScoped<RowAuditWriter>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddCmsJwtAuthentication();

var app = builder.Build();

// First in the pipeline so an exception anywhere below becomes a generic 500 { message } (details only in the log).
app.UseMiddleware<UnhandledExceptionMiddleware>();

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "CMS API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors(LocalhostCors);
app.UseAuthentication();
app.UseAuthorization();
// Every controller needs a logged-in user unless it opts out with [AllowAnonymous] (AuthController, agent-token ingest).
app.MapControllers().RequireAuthorization();

app.Run();

// Exposed for WebApplicationFactory in CMS.API.Tests
public partial class Program { }
