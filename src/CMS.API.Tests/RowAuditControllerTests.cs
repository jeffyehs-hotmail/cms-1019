using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CMS.API.Security;
using CMS.API.Models;

namespace CMS.API.Tests;

public class RowAuditControllerTests : IDisposable
{
    private const string Url = "/api/rowaudit";
    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public RowAuditControllerTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    private async Task SeedAsync(string table, string pk, string action, string user, DateTime at, string? desc = null)
        => await _factory.RowAudits.InsertAsync(new RowAudit
        {
            TableName = table, PrimaryKeyValues = pk, ActionType = action, UserName = user, DateTime = at, ActionDesc = desc,
        });

    [Fact]
    public async Task Get_ReturnsOnlyTheRecordsRows_NewestFirst()
    {
        await SeedAsync("Course", "123", "Insert", "alice", new DateTime(2026, 6, 1, 9, 0, 0), "AZ-900");
        await SeedAsync("Course", "123", "Update", "bob", new DateTime(2026, 6, 4, 14, 30, 0), "Title,ListPrice");
        await SeedAsync("Course", "123", "Update", "carol", new DateTime(2026, 6, 2, 10, 0, 0), "DisplayOrder");
        await SeedAsync("Course", "12", "Update", "dave", new DateTime(2026, 6, 5, 8, 0, 0), "Title");
        await SeedAsync("Partner", "123", "Update", "erin", new DateTime(2026, 6, 6, 8, 0, 0), "Name");

        var res = await _client.GetAsync($"{Url}?tableName=Course&pkid=123");
        var rows = await res.Content.ReadFromJsonAsync<List<RowAuditEntry>>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(["bob", "carol", "alice"], rows!.Select(r => r.UserName));
        var latest = rows[0];
        Assert.Equal(new DateTime(2026, 6, 4, 14, 30, 0), latest.DateTime);
        Assert.Equal("Update", latest.ActionType);
        Assert.Equal("Title,ListPrice", latest.ActionDesc);
    }

    [Fact]
    public async Task Get_SameDateTime_LaterRowFirst()
    {
        var at = new DateTime(2026, 6, 4, 14, 30, 0);
        await SeedAsync("CourseGroup", "7", "Insert", "alice", at, "x");
        await SeedAsync("CourseGroup", "7", "Delete", "alice", at, "x");

        var rows = await _client.GetFromJsonAsync<List<RowAuditEntry>>($"{Url}?tableName=CourseGroup&pkid=7");

        Assert.Equal(["Delete", "Insert"], rows!.Select(r => r.ActionType));
    }

    [Fact]
    public async Task Get_NoHistory_ReturnsEmptyList()
    {
        await SeedAsync("Course", "1", "Insert", "alice", new DateTime(2026, 6, 1));

        var rows = await _client.GetFromJsonAsync<List<RowAuditEntry>>($"{Url}?tableName=Course&pkid=999");

        Assert.Empty(rows!);
    }

    [Theory]
    [InlineData("?pkid=1")]
    [InlineData("?tableName=Course")]
    [InlineData("?tableName=%20&pkid=1")]
    [InlineData("")]
    public async Task Get_MissingTableNameOrPkid_Returns400WithMessage(string query)
    {
        var res = await _client.GetAsync(Url + query);
        var body = await res.Content.ReadFromJsonAsync<Dictionary<string, string>>();

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("請指定資料表名稱與主代碼", body!["message"]);
    }

    [Fact]
    public async Task Get_Anonymous_Returns401()
    {
        _client.DefaultRequestHeaders.Authorization = null;

        var res = await _client.GetAsync($"{Url}?tableName=Course&pkid=1");

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    // Review finding (/ship 2026-10-22): non-admins could read AppUser/AppRole history (every account id, who granted
    // which roles) although those APIs are Admin-only. CLAUDE.md: role limits are enforced by the API.
    [Theory]
    [InlineData("AppUser", "User")]
    [InlineData("approle", "User")]    // table match ignores case, like the DB
    [InlineData("AppUser", "admin")]    // role match is exact
    public async Task Get_AdminTableAsNonAdmin_Returns403WithMessage(string table, string role)
    {
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CmsApiFactory.AccessToken("carol", "Carol", [role]));

        var res = await _client.GetAsync($"{Url}?tableName={table}&pkid=1");

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Equal(JwtAuthentication.Forbidden,
            (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString());
    }

    [Fact]
    public async Task Get_OtherTableAsNonAdmin_Returns200()
    {
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CmsApiFactory.AccessToken("carol", "Carol", ["User"]));

        var res = await _client.GetAsync($"{Url}?tableName=Course&pkid=1");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }
}
