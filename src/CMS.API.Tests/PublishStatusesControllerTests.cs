using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CMS.API.Security;
using CMS.API.Models;

namespace CMS.API.Tests;

public class PublishStatusesControllerTests : IDisposable
{
    private const string Url = "/api/publish-statuses";
    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public PublishStatusesControllerTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    // ---------- List ----------

    [Fact]
    public async Task GetAll_ReturnsAll_OrderedByPkid()
    {
        var rows = await _client.GetFromJsonAsync<List<PublishStatus>>(Url);

        Assert.NotNull(rows);
        Assert.Equal([1, 2, 3], rows.Select(s => (int)s.Pkid));
        Assert.Equal(5, rows.Single(s => s.Pkid == 2).CourseCount);
    }

    // ---------- Query / filter ----------

    [Fact]
    public async Task Query_ByKeyword_MatchesDescription()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new PublishStatusQuery { Keyword = "上架" });
        var rows = await res.Content.ReadFromJsonAsync<List<PublishStatus>>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(2, Assert.Single(rows!).Pkid);
    }

    [Fact]
    public async Task Query_ByBoolFlag_FiltersExactMatch()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new PublishStatusQuery { IsDraft = false });
        var rows = await res.Content.ReadFromJsonAsync<List<PublishStatus>>();

        Assert.Equal([2, 3], rows!.Select(s => (int)s.Pkid));
    }

    [Fact]
    public async Task Query_EmptyFilter_ReturnsAll()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new PublishStatusQuery());
        var rows = await res.Content.ReadFromJsonAsync<List<PublishStatus>>();

        Assert.Equal(3, rows!.Count);
    }

    // ---------- View ----------

    [Fact]
    public async Task GetById_Existing_ReturnsStatus()
    {
        var status = await _client.GetFromJsonAsync<PublishStatus>($"{Url}/3");

        Assert.NotNull(status);
        Assert.Equal("已下架", status.Description);
        Assert.True(status.IsDiscontinued);
    }

    [Theory]
    [InlineData(99)]
    [InlineData(999)]
    public async Task GetById_Missing_Returns404(int id)
    {
        var res = await _client.GetAsync($"{Url}/{id}");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ---------- Add ----------

    [Fact]
    public async Task Create_Valid_Returns201WithSuppliedPkid()
    {
        var req = new PublishStatusRequest { Pkid = 10, Description = " Review ", IsDraft = true };

        var res = await _client.PostAsJsonAsync(Url, req);
        var created = await res.Content.ReadFromJsonAsync<PublishStatus>();

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        Assert.EndsWith($"{Url}/10", res.Headers.Location!.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal(10, created!.Pkid);
        Assert.Equal("Review", created.Description);
        Assert.True(await _factory.PublishStatuses.ExistsAsync(10));
    }

    [Fact]
    public async Task Create_DuplicatePkid_Returns409()
    {
        var res = await _client.PostAsJsonAsync(Url, new PublishStatusRequest { Pkid = 1, Description = "Dup" });

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    [Theory]
    [InlineData(0, "Name")]
    [InlineData(10, "")]
    public async Task Create_MissingRequiredField_Returns400(byte pkid, string description)
    {
        var res = await _client.PostAsJsonAsync(Url, new PublishStatusRequest { Pkid = pkid, Description = description });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Create_DescriptionTooLong_Returns400()
    {
        var res = await _client.PostAsJsonAsync(Url,
            new PublishStatusRequest { Pkid = 10, Description = new string('x', 51) });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Create_PkidOutOfTinyintRange_Returns400()
    {
        var res = await _client.PostAsJsonAsync(Url, new { pkid = 300, description = "Too big" });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // ---------- Edit ----------

    [Fact]
    public async Task Update_Existing_UpdatesFields()
    {
        var req = new PublishStatusRequest { Pkid = 1, Description = "Draft", IsDraft = true, IsPublished = true };

        var res = await _client.PutAsJsonAsync(Url, req);
        var updated = await res.Content.ReadFromJsonAsync<PublishStatus>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(1, updated!.Pkid);
        Assert.Equal("Draft", updated.Description);
        Assert.True(updated.IsPublished);
    }

    [Fact]
    public async Task Update_Missing_Returns404()
    {
        var res = await _client.PutAsJsonAsync(Url, new PublishStatusRequest { Pkid = 99, Description = "X" });

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Update_WithoutPkid_Returns400()
    {
        var res = await _client.PutAsJsonAsync(Url, new PublishStatusRequest { Description = "X" });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // ---------- Delete ----------

    [Fact]
    public async Task Delete_Unused_Returns204ThenGone()
    {
        var res = await _client.DeleteAsync($"{Url}/3");

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"{Url}/3")).StatusCode);
    }

    [Fact]
    public async Task Delete_InUse_Returns409AndKeepsRow()
    {
        var res = await _client.DeleteAsync($"{Url}/2");

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.True(await _factory.PublishStatuses.ExistsAsync(2));
    }

    [Fact]
    public async Task Delete_Missing_Returns404()
    {
        var res = await _client.DeleteAsync($"{Url}/99");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ---------- Admin only ----------
    // Review finding (/ship 2026-10-22): the 系統管理 screens hid this from non-admins but the API let any signed-in
    // user in (a User created and deleted a PublishStatus live). CLAUDE.md: an adminOnly menu item needs the API role check.

    [Theory]
    [InlineData("GET", "", "User")]
    [InlineData("POST", "/query", "User")]
    [InlineData("GET", "/1", "User")]
    [InlineData("POST", "", "User")]
    [InlineData("PUT", "", "User")]
    [InlineData("DELETE", "/2", "admin")]   // role match is exact
    public async Task EveryAction_NonAdmin_Returns403WithMessage(string method, string path, string role)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CmsApiFactory.AccessToken("carol", "Carol", [role]));

        var res = await client.SendAsync(
            new HttpRequestMessage(new HttpMethod(method), Url + path) { Content = JsonContent.Create(new { }) });

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Equal(JwtAuthentication.Forbidden,
            (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString());
    }

    // ---------- Lookup ----------

    [Fact]
    public async Task Lookup_ReturnsSlimList_OrderedByPkid()
    {
        var rows = await _client.GetFromJsonAsync<List<PublishStatusLookup>>("/api/lookups/publish-statuses");

        Assert.Equal(["草稿", "上架中", "已下架"], rows!.Select(s => s.Description));
    }
}
