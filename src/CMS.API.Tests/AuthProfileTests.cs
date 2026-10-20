using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CMS.API.Models;

namespace CMS.API.Tests;

/// <summary>GET / PUT api/auth/profile: the signed-in user reads their profile and changes only their own UserName.</summary>
public class AuthProfileTests : IDisposable
{
    private const string Url = "/api/auth/profile";

    private readonly CmsApiFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private HttpClient ClientAs(string userId, string userName)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CmsApiFactory.AccessToken(userId, userName, []));
        return client;
    }

    private static async Task<string?> MessageOf(HttpResponseMessage res)
        => (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString();

    // ---------- GET ----------

    [Fact]
    public async Task GetProfile_ReturnsJwtUserWithRoleNames()
    {
        var res = await _factory.CreateClient().GetAsync(Url);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = (await res.Content.ReadFromJsonAsync<UserProfile>())!;
        Assert.Equal("alice", body.UserId);
        Assert.Equal("Alice", body.UserName);
        Assert.Equal(["Admin", "User"], body.Roles.Select(r => r.RoleId));
        Assert.Equal(["Administrator", "User"], body.Roles.Select(r => r.RoleName));
    }

    [Fact]
    public async Task GetProfile_UserWithoutRoles_ReturnsEmptyRoles()
    {
        var body = await ClientAs("carol", "Carol").GetFromJsonAsync<UserProfile>(Url);

        Assert.Equal("carol", body!.UserId);
        Assert.Empty(body.Roles);
    }

    [Fact]
    public async Task GetProfile_JwtUserNoLongerExists_Returns404WithMessage()
    {
        var res = await ClientAs("ghost", "Ghost").GetAsync(Url);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        Assert.Equal("找不到目前登入的使用者", await MessageOf(res));
    }

    [Fact]
    public async Task Profile_WithoutToken_Returns401()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = null;

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(Url)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PutAsJsonAsync(Url, new { userName = "X" })).StatusCode);
        Assert.Equal("Alice", _factory.Auth.Find("alice").UserName);
    }

    // ---------- PUT ----------

    [Fact]
    public async Task UpdateProfile_UpdatesUserNameOfJwtUser()
    {
        var res = await ClientAs("carol", "Carol").PutAsJsonAsync(Url, new { userName = "Carol Chen" });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = (await res.Content.ReadFromJsonAsync<UserProfile>())!;
        Assert.Equal("carol", body.UserId);
        Assert.Equal("Carol Chen", body.UserName);
        Assert.Equal("Carol Chen", _factory.Auth.Find("carol").UserName);
        Assert.Equal("Alice", _factory.Auth.Find("alice").UserName);
    }

    [Fact]
    public async Task UpdateProfile_TrimsUserName()
    {
        var res = await _factory.CreateClient().PutAsJsonAsync(Url, new { userName = "  Alice Wang \t" });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("Alice Wang", _factory.Auth.Find("alice").UserName);
    }

    [Fact]
    public async Task UpdateProfile_IgnoresUserIdAndRolesInBody()
    {
        var res = await ClientAs("carol", "Carol").PutAsJsonAsync(Url, new
        {
            userId = "alice",
            userName = "Hijacked",
            roleIds = new[] { "Admin" },
            roles = new[] { new { roleId = "Admin" } },
        });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = (await res.Content.ReadFromJsonAsync<UserProfile>())!;
        Assert.Equal("carol", body.UserId);
        Assert.Empty(body.Roles);
        Assert.Equal("Hijacked", _factory.Auth.Find("carol").UserName);
        Assert.Equal("Alice", _factory.Auth.Find("alice").UserName);
        Assert.Empty(await _factory.Auth.GetRoleIdsAsync("carol"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\n")]
    [InlineData(null)]
    public async Task UpdateProfile_EmptyOrWhitespaceUserName_Returns400AndChangesNothing(string? userName)
    {
        var res = await _factory.CreateClient().PutAsJsonAsync(Url, new { userName });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("Alice", _factory.Auth.Find("alice").UserName);
    }

    [Fact]
    public async Task UpdateProfile_UserNameOver200Chars_Returns400()
    {
        var res = await _factory.CreateClient().PutAsJsonAsync(Url, new { userName = new string('x', 201) });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("Alice", _factory.Auth.Find("alice").UserName);
    }

    [Fact]
    public async Task UpdateProfile_JwtUserNoLongerExists_Returns404()
    {
        var res = await ClientAs("ghost", "Ghost").PutAsJsonAsync(Url, new { userName = "Ghost 2" });

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        Assert.Equal("找不到目前登入的使用者", await MessageOf(res));
    }
}
