using System.Net;
using System.Net.Http.Json;
using CMS.API.Models;

namespace CMS.API.Tests;

public class AppRolesControllerTests : IDisposable
{
    private const string Url = "/api/app-roles";
    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public AppRolesControllerTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    // ---------- List ----------

    [Fact]
    public async Task GetAll_ReturnsAllRoles_OrderedByRoleId()
    {
        var roles = await _client.GetFromJsonAsync<List<AppRole>>(Url);

        Assert.NotNull(roles);
        Assert.Equal(["Admin", "Editor", "User"], roles.Select(r => r.RoleId));
        Assert.Equal(2, roles.Single(r => r.RoleId == "Admin").UserCount);
    }

    // ---------- Query / filter ----------

    [Fact]
    public async Task Query_ByKeyword_MatchesRoleIdNameOrDescription()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new AppRoleQuery { Keyword = "管理" });
        var roles = await res.Content.ReadFromJsonAsync<List<AppRole>>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("Admin", Assert.Single(roles!).RoleId);
    }

    [Fact]
    public async Task Query_ByPermissionLevelRange_FiltersInclusive()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query",
            new AppRoleQuery { PermissionLevelFrom = 50, PermissionLevelTo = 100 });
        var roles = await res.Content.ReadFromJsonAsync<List<AppRole>>();

        Assert.Equal(["Editor", "User"], roles!.Select(r => r.RoleId));
    }

    [Fact]
    public async Task Query_EmptyFilter_ReturnsAll()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new AppRoleQuery());
        var roles = await res.Content.ReadFromJsonAsync<List<AppRole>>();

        Assert.Equal(3, roles!.Count);
    }

    // ---------- View ----------

    [Fact]
    public async Task GetById_Existing_ReturnsRoleWithUsers()
    {
        var role = await _client.GetFromJsonAsync<AppRole>($"{Url}/1");

        Assert.NotNull(role);
        Assert.Equal("Admin", role.RoleId);
        Assert.Equal(["alice", "bob"], role.Users.Select(u => u.UserId));
    }

    [Fact]
    public async Task GetById_Missing_Returns404()
    {
        var res = await _client.GetAsync($"{Url}/999");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ---------- Add ----------

    [Fact]
    public async Task Create_Valid_Returns201WithLocationAndBody()
    {
        var req = new AppRoleRequest
        {
            RoleId = "Auditor", RoleName = "Auditor", PermissionLevel = 80,
            Description = "稽核", UserIds = ["alice"]
        };

        var res = await _client.PostAsJsonAsync(Url, req);
        var created = await res.Content.ReadFromJsonAsync<AppRole>();

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        Assert.EndsWith($"{Url}/{created!.Pkid}", res.Headers.Location!.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Auditor", created.RoleId);
        Assert.Equal(1, created.UserCount);
        Assert.True(await _factory.AppRoles.RoleIdExistsAsync("Auditor"));
    }

    [Fact]
    public async Task Create_DuplicateRoleId_Returns409()
    {
        var res = await _client.PostAsJsonAsync(Url,
            new AppRoleRequest { RoleId = "Admin", RoleName = "Dup", PermissionLevel = 1 });

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    [Theory]
    [InlineData("", "Name")]
    [InlineData("Id", "")]
    public async Task Create_MissingRequiredField_Returns400(string roleId, string roleName)
    {
        var res = await _client.PostAsJsonAsync(Url,
            new AppRoleRequest { RoleId = roleId, RoleName = roleName, PermissionLevel = 1 });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Create_RoleIdTooLong_Returns400()
    {
        var res = await _client.PostAsJsonAsync(Url,
            new AppRoleRequest { RoleId = new string('x', 201), RoleName = "Long", PermissionLevel = 1 });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // ---------- Edit ----------

    [Fact]
    public async Task Update_Existing_UpdatesFieldsAndUsers_KeepsRoleId()
    {
        var req = new AppRoleRequest
        {
            Pkid = 2, RoleId = "ShouldBeIgnored", RoleName = "Normal User",
            PermissionLevel = 90, Description = "更新", UserIds = ["alice", "carol"]
        };

        var res = await _client.PutAsJsonAsync(Url, req);
        var updated = await res.Content.ReadFromJsonAsync<AppRole>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("User", updated!.RoleId);
        Assert.Equal("Normal User", updated.RoleName);
        Assert.Equal(90, updated.PermissionLevel);
        Assert.Equal("更新", updated.Description);
        Assert.Equal(["alice", "carol"], updated.Users.Select(u => u.UserId));
    }

    [Fact]
    public async Task Update_Missing_Returns404()
    {
        var res = await _client.PutAsJsonAsync(Url,
            new AppRoleRequest { Pkid = 999, RoleId = "X", RoleName = "X", PermissionLevel = 1 });

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Update_WithoutPkid_Returns400()
    {
        var res = await _client.PutAsJsonAsync(Url,
            new AppRoleRequest { RoleId = "X", RoleName = "X", PermissionLevel = 1 });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // ---------- Delete ----------

    [Fact]
    public async Task Delete_Existing_Returns204ThenGone()
    {
        var res = await _client.DeleteAsync($"{Url}/3");

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"{Url}/3")).StatusCode);
    }

    // ---------- Infrastructure ----------

    [Fact]
    public async Task Cors_AllowsLocalhostOrigin()
    {
        var req = new HttpRequestMessage(HttpMethod.Get, Url);
        req.Headers.Add("Origin", "http://localhost:4200");

        var res = await _client.SendAsync(req);

        Assert.Equal("http://localhost:4200", res.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }

    [Fact]
    public async Task Swagger_DocumentIsServed()
    {
        var res = await _client.GetAsync("/swagger/v1/swagger.json");
        var body = await res.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Contains("/api/app-roles", body);
    }
}
