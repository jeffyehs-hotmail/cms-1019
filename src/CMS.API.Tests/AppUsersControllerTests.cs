using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CMS.API.Models;
using CMS.API.Security;

namespace CMS.API.Tests;

public class AppUsersControllerTests : IDisposable
{
    private const string Url = "/api/app-users";
    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public AppUsersControllerTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    private static AppUserRequest NewRequest(int pkid = 0, string userId = "dave") => new()
    {
        Pkid = pkid,
        UserId = userId,
        UserName = "Dave",
        IsActive = true,
        RoleIds = ["Editor", "User", "User"],
    };

    private static async Task<string?> MessageOf(HttpResponseMessage res)
        => (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString();

    // ---------- List ----------

    [Fact]
    public async Task GetAll_ReturnsAll_OrderedByUserId_WithRoleCounts()
    {
        var rows = await _client.GetFromJsonAsync<List<AppUser>>(Url);

        Assert.NotNull(rows);
        Assert.Equal(["alice", "bob", "carol"], rows.Select(u => u.UserId));
        Assert.Equal([2, 1, 0], rows.Select(u => u.RoleCount));
        Assert.All(rows, u => Assert.Empty(u.Roles));
    }

    [Fact]
    public async Task Responses_NeverContainPasswordHash()
    {
        var list = await _client.GetStringAsync(Url);
        var one = await _client.GetStringAsync($"{Url}/1");

        Assert.DoesNotContain("password", list.Replace("passwordUpdatedTime", ""), StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("password", one.Replace("passwordUpdatedTime", ""), StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("seed-hash", one);
    }

    // ---------- Query / filter ----------

    [Theory]
    [InlineData("ALI", "alice")]   // UserId, case-insensitive
    [InlineData("Car", "carol")]   // UserName
    public async Task Query_ByKeyword(string keyword, string expected)
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new AppUserQuery { Keyword = keyword });
        var rows = await res.Content.ReadFromJsonAsync<List<AppUser>>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(expected, Assert.Single(rows!).UserId);
    }

    [Fact]
    public async Task Query_ByIsActive()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new AppUserQuery { IsActive = false });
        var rows = await res.Content.ReadFromJsonAsync<List<AppUser>>();

        Assert.Equal("bob", Assert.Single(rows!).UserId);
    }

    [Fact]
    public async Task Query_ByRoleId()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new AppUserQuery { RoleId = "User" });
        var rows = await res.Content.ReadFromJsonAsync<List<AppUser>>();

        Assert.Equal(["alice", "bob"], rows!.Select(u => u.UserId));
    }

    [Fact]
    public async Task Query_EmptyFilter_ReturnsAll()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new AppUserQuery());
        var rows = await res.Content.ReadFromJsonAsync<List<AppUser>>();

        Assert.Equal(3, rows!.Count);
    }

    // ---------- Get by id ----------

    [Fact]
    public async Task GetById_Found_IncludesRoles()
    {
        var user = await _client.GetFromJsonAsync<AppUser>($"{Url}/1");

        Assert.NotNull(user);
        Assert.Equal("alice", user.UserId);
        Assert.Equal(["Admin", "User"], user.Roles.Select(r => r.RoleId));
        Assert.Equal("Administrator", user.Roles[0].RoleName);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        var res = await _client.GetAsync($"{Url}/999");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ---------- Create ----------

    [Fact]
    public async Task Create_Returns201_AndStoresDefaultPasswordHash()
    {
        var res = await _client.PostAsJsonAsync(Url, NewRequest(userId: "  dave  "));
        var created = await res.Content.ReadFromJsonAsync<AppUser>();

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        Assert.NotNull(res.Headers.Location);
        Assert.Equal("dave", created!.UserId);
        Assert.True(created.IsActive);
        Assert.Null(created.PasswordUpdatedTime);
        Assert.Equal(["Editor", "User"], created.Roles.Select(r => r.RoleId));

        var stored = _factory.AppUsers.Find(created.Pkid)!;
        Assert.Equal(PasswordHasher.Hash(FakeAppUserRepository.DefaultPassword), stored.PasswordHash);
    }

    [Fact]
    public async Task Create_IgnoresPasswordHashInPayload()
    {
        var res = await _client.PostAsJsonAsync(Url, new
        {
            userId = "eve", userName = "Eve", isActive = true, roleIds = Array.Empty<string>(),
            passwordHash = "attacker-chosen",
        });
        var created = await res.Content.ReadFromJsonAsync<AppUser>();

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        Assert.Equal(PasswordHasher.Hash(FakeAppUserRepository.DefaultPassword), _factory.AppUsers.Find(created!.Pkid)!.PasswordHash);
    }

    [Fact]
    public async Task Create_DuplicateUserId_Returns409WithMessage()
    {
        var res = await _client.PostAsJsonAsync(Url, NewRequest(userId: "ALICE"));

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Contains("ALICE", await MessageOf(res));
    }

    [Fact]
    public async Task Create_UnknownRole_Returns400WithMessage()
    {
        var req = NewRequest();
        req.RoleIds = ["Admin", "Ghost"];
        var res = await _client.PostAsJsonAsync(Url, req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("Ghost", await MessageOf(res));
    }

    [Theory]
    [InlineData("", "Dave")]
    [InlineData("dave", "")]
    public async Task Create_MissingRequired_Returns400(string userId, string userName)
    {
        var req = NewRequest(userId: userId);
        req.UserName = userName;
        var res = await _client.PostAsJsonAsync(Url, req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Create_WhitespaceUserName_Returns400()
    {
        var req = NewRequest();
        req.UserName = "   ";
        var res = await _client.PostAsJsonAsync(Url, req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Create_TooLongUserId_Returns400()
    {
        var res = await _client.PostAsJsonAsync(Url, NewRequest(userId: new string('x', 201)));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("{ broken")]
    [InlineData("""{ "enforcePasswordPolicy": true }""")]
    public async Task Create_MissingDefaultPassword_Returns500WithMessage(string? appConfig)
    {
        _factory.AppUsers.AppConfigValue = appConfig;
        var res = await _client.PostAsJsonAsync(Url, NewRequest());

        Assert.Equal(HttpStatusCode.InternalServerError, res.StatusCode);
        Assert.Contains("defaultPassword", await MessageOf(res));
        Assert.Equal(3, (await _client.GetFromJsonAsync<List<AppUser>>(Url))!.Count);
    }

    // ---------- Update ----------

    [Fact]
    public async Task Update_Returns200_KeepsUserIdAndPasswordHash()
    {
        var res = await _client.PutAsJsonAsync(Url, new AppUserRequest
        {
            Pkid = 2, UserId = "renamed", UserName = "Bobby", IsActive = true, RoleIds = ["Admin"],
        });
        var updated = await res.Content.ReadFromJsonAsync<AppUser>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("bob", updated!.UserId);
        Assert.Equal("Bobby", updated.UserName);
        Assert.True(updated.IsActive);
        Assert.Equal(["Admin"], updated.Roles.Select(r => r.RoleId));
        Assert.Equal("seed-hash", _factory.AppUsers.Find(2)!.PasswordHash);
    }

    [Fact]
    public async Task Update_NotFound_Returns404()
    {
        var res = await _client.PutAsJsonAsync(Url, NewRequest(pkid: 999));
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Update_MissingPkid_Returns400()
    {
        var res = await _client.PutAsJsonAsync(Url, NewRequest(pkid: 0));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Update_UnknownRole_Returns400()
    {
        var req = NewRequest(pkid: 1);
        req.RoleIds = ["Ghost"];
        var res = await _client.PutAsJsonAsync(Url, req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal(["Admin", "User"], (await _client.GetFromJsonAsync<AppUser>($"{Url}/1"))!.Roles.Select(r => r.RoleId));
    }

    // ---------- Reset password ----------

    [Fact]
    public async Task ResetPassword_Returns204_AndRestoresDefaultHash()
    {
        var res = await _client.PostAsync($"{Url}/1/reset-password", null);

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        var stored = _factory.AppUsers.Find(1)!;
        Assert.Equal(PasswordHasher.Hash(FakeAppUserRepository.DefaultPassword), stored.PasswordHash);
        Assert.Null(stored.User.PasswordUpdatedTime);
    }

    [Fact]
    public async Task ResetPassword_NotFound_Returns404()
    {
        var res = await _client.PostAsync($"{Url}/999/reset-password", null);
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_MissingDefaultPassword_Returns500_AndKeepsHash()
    {
        _factory.AppUsers.AppConfigValue = null;
        var res = await _client.PostAsync($"{Url}/1/reset-password", null);

        Assert.Equal(HttpStatusCode.InternalServerError, res.StatusCode);
        Assert.Equal("seed-hash", _factory.AppUsers.Find(1)!.PasswordHash);
    }

    // ---------- Delete ----------

    [Fact]
    public async Task Delete_Returns204_ThenNotFound()
    {
        var res = await _client.DeleteAsync($"{Url}/1");
        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);

        var get = await _client.GetAsync($"{Url}/1");
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
    }

    [Fact]
    public async Task Delete_NotFound_Returns404()
    {
        var res = await _client.DeleteAsync($"{Url}/999");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Delete_WithAgentTokenUsage_Returns409()
    {
        _factory.AppUsers.SetAgentTokenUsageCount("alice", 3);

        var res = await _client.DeleteAsync($"{Url}/1");

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Contains("3 筆 Token 用量", await MessageOf(res));
        Assert.NotNull(_factory.AppUsers.Find(1));
    }

    // ---------- Agent token ----------

    [Fact]
    public async Task RegenerateAgentToken_ReturnsTokenOnce_AndStoresOnlyItsHash()
    {
        var res = await _client.PostAsync($"{Url}/1/regenerate-agent-token", null);
        var body = await res.Content.ReadFromJsonAsync<AgentTokenResponse>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Matches("^cms_at_[A-Za-z0-9_-]{43}$", body!.Token);
        Assert.Equal(AgentTokenHasher.Hash(body.Token), _factory.AppUsers.Find(1)!.AgentTokenHash);

        var user = await _client.GetStringAsync($"{Url}/1");
        Assert.DoesNotContain(body.Token, user);
        Assert.DoesNotContain(AgentTokenHasher.Hash(body.Token), user);
        Assert.Contains("\"hasAgentToken\":true", user);
    }

    [Fact]
    public async Task RegenerateAgentToken_ReplacesTheOldToken()
    {
        var first = (await (await _client.PostAsync($"{Url}/1/regenerate-agent-token", null))
            .Content.ReadFromJsonAsync<AgentTokenResponse>())!.Token;
        var second = (await (await _client.PostAsync($"{Url}/1/regenerate-agent-token", null))
            .Content.ReadFromJsonAsync<AgentTokenResponse>())!.Token;

        Assert.NotEqual(first, second);
        Assert.Null(_factory.AppUsers.FindActiveUserIdByAgentTokenHash(AgentTokenHasher.Hash(first)));
        Assert.Equal("alice", _factory.AppUsers.FindActiveUserIdByAgentTokenHash(AgentTokenHasher.Hash(second)));
    }

    [Fact]
    public async Task RevokeAgentToken_ClearsTheHash()
    {
        await _client.PostAsync($"{Url}/1/regenerate-agent-token", null);

        var res = await _client.PostAsync($"{Url}/1/revoke-agent-token", null);

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.Null(_factory.AppUsers.Find(1)!.AgentTokenHash);
        Assert.False((await _client.GetFromJsonAsync<AppUser>($"{Url}/1"))!.HasAgentToken);
    }

    [Theory]
    [InlineData("regenerate-agent-token")]
    [InlineData("revoke-agent-token")]
    public async Task AgentTokenActions_NotFound_Return404(string action)
    {
        var res = await _client.PostAsync($"{Url}/999/{action}", null);
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ---------- Lookup ----------

    [Fact]
    public async Task LookupAppRoles_ReturnsRolesOrderedByRoleId()
    {
        var rows = await _client.GetFromJsonAsync<List<AppRoleLookup>>("/api/lookups/app-roles");

        Assert.Equal(["Admin", "Editor", "User"], rows!.Select(r => r.RoleId));
    }
}
