using System.Net;
using System.Net.Http.Json;
using CMS.API.Models;

namespace CMS.API.Tests;

public class CourseGroupsControllerTests : IDisposable
{
    private const string Url = "/api/course-groups";
    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public CourseGroupsControllerTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    // ---------- List ----------

    [Fact]
    public async Task GetAll_ReturnsAll_OrderedByPkidDesc()
    {
        var rows = await _client.GetFromJsonAsync<List<CourseGroup>>(Url);

        Assert.NotNull(rows);
        Assert.Equal([3, 2, 1], rows.Select(g => (int)g.Pkid));
        Assert.Equal(12, rows.Single(g => g.Pkid == 1).CourseCount);
    }

    // ---------- Query / filter ----------

    [Theory]
    [InlineData("windows", 1)]
    [InlineData("雲端", 2)]
    public async Task Query_ByKeyword_MatchesDescription(string keyword, int expectedPkid)
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new CourseGroupQuery { Keyword = keyword });
        var rows = await res.Content.ReadFromJsonAsync<List<CourseGroup>>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(expectedPkid, Assert.Single(rows!).Pkid);
    }

    [Fact]
    public async Task Query_EmptyFilter_ReturnsAll()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new CourseGroupQuery());
        var rows = await res.Content.ReadFromJsonAsync<List<CourseGroup>>();

        Assert.Equal(3, rows!.Count);
    }

    // ---------- View ----------

    [Fact]
    public async Task GetById_Existing_ReturnsGroup()
    {
        var group = await _client.GetFromJsonAsync<CourseGroup>($"{Url}/3");

        Assert.NotNull(group);
        Assert.Equal("CCNA", group.Description);
        Assert.Equal(2, group.PartnerCourseGroupCount);
    }

    [Theory]
    [InlineData(99)]
    [InlineData(0)]
    [InlineData(99999)]
    public async Task GetById_Missing_Returns404(int id)
    {
        var res = await _client.GetAsync($"{Url}/{id}");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ---------- Add ----------

    [Fact]
    public async Task Create_Valid_Returns201AndTrims()
    {
        var res = await _client.PostAsJsonAsync(Url, new CourseGroupRequest { Description = "  Linux  " });
        var created = await res.Content.ReadFromJsonAsync<CourseGroup>();

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        Assert.EndsWith($"{Url}/{created!.Pkid}", res.Headers.Location!.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Linux", created.Description);
        Assert.NotNull(await _factory.CourseGroups.GetByIdAsync(created.Pkid));
    }

    [Fact]
    public async Task Create_DuplicateDescription_IsAllowed()
    {
        var res = await _client.PostAsJsonAsync(Url, new CourseGroupRequest { Description = "CCNA" });

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Create_MissingDescription_Returns400(string description)
    {
        var res = await _client.PostAsJsonAsync(Url, new CourseGroupRequest { Description = description });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Create_DescriptionTooLong_Returns400()
    {
        var res = await _client.PostAsJsonAsync(Url, new CourseGroupRequest { Description = new string('x', 101) });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // ---------- Edit ----------

    [Fact]
    public async Task Update_Existing_UpdatesDescription()
    {
        var res = await _client.PutAsJsonAsync(Url, new CourseGroupRequest { Pkid = 2, Description = "Azure" });
        var updated = await res.Content.ReadFromJsonAsync<CourseGroup>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(2, updated!.Pkid);
        Assert.Equal("Azure", updated.Description);
    }

    [Fact]
    public async Task Update_Missing_Returns404()
    {
        var res = await _client.PutAsJsonAsync(Url, new CourseGroupRequest { Pkid = 99, Description = "x" });

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Update_WithoutPkid_Returns400()
    {
        var res = await _client.PutAsJsonAsync(Url, new CourseGroupRequest { Description = "x" });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // ---------- Delete ----------

    [Fact]
    public async Task Delete_Unused_Returns204ThenGone()
    {
        var res = await _client.DeleteAsync($"{Url}/2");

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"{Url}/2")).StatusCode);
    }

    [Theory]
    [InlineData(1)]   // courses + partner course groups
    [InlineData(3)]   // partner course groups only
    public async Task Delete_InUse_Returns409AndKeepsRow(short pkid)
    {
        var res = await _client.DeleteAsync($"{Url}/{pkid}");

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Contains("無法刪除", await res.Content.ReadAsStringAsync());
        Assert.NotNull(await _factory.CourseGroups.GetByIdAsync(pkid));
    }

    [Fact]
    public async Task Delete_Missing_Returns404()
    {
        var res = await _client.DeleteAsync($"{Url}/99");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ---------- Lookup ----------

    [Fact]
    public async Task Lookup_ReturnsSlimList_OrderedByDescription()
    {
        var rows = await _client.GetFromJsonAsync<List<CourseGroupLookup>>("/api/lookups/course-groups");

        Assert.Equal(["Azure 雲端", "CCNA", "Windows Server"], rows!.Select(g => g.Description));
    }
}
