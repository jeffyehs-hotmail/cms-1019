using System.Net;
using System.Net.Http.Json;
using CMS.API.Models;

namespace CMS.API.Tests;

public class PartnersControllerTests : IDisposable
{
    private const string Url = "/api/partners";
    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public PartnersControllerTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    private static PartnerRequest NewRequest(short pkid = 0, string appKey = "aws") => new()
    {
        Pkid = pkid,
        Name = "AWS",
        AppKey = appKey,
        NameOnPartnerMenu = "Amazon Web Services",
        NameOnCourseDetailPage = "AWS",
        DisplayOrder = 5,
        ImageFilename = "AWS.svg"
    };

    // ---------- List ----------

    [Fact]
    public async Task GetAll_ReturnsAll_OrderedByDisplayOrder()
    {
        var rows = await _client.GetFromJsonAsync<List<Partner>>(Url);

        Assert.NotNull(rows);
        Assert.Equal([3, 1, 2], rows.Select(p => (int)p.Pkid));
        Assert.Equal(243, rows.Single(p => p.Pkid == 1).CourseCount);
    }

    // ---------- Query / filter ----------

    [Theory]
    [InlineData("orac", 2)]      // Name / AppKey
    [InlineData("思科", 3)]       // NameOnPartnerMenu
    [InlineData("ms.png", 1)]    // ImageFilename
    public async Task Query_ByKeyword_MatchesStringColumns(string keyword, int expectedPkid)
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new PartnerQuery { Keyword = keyword });
        var rows = await res.Content.ReadFromJsonAsync<List<Partner>>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(expectedPkid, Assert.Single(rows!).Pkid);
    }

    [Fact]
    public async Task Query_EmptyFilter_ReturnsAll()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new PartnerQuery());
        var rows = await res.Content.ReadFromJsonAsync<List<Partner>>();

        Assert.Equal(3, rows!.Count);
    }

    // ---------- View ----------

    [Fact]
    public async Task GetById_Existing_ReturnsPartner()
    {
        var partner = await _client.GetFromJsonAsync<Partner>($"{Url}/2");

        Assert.NotNull(partner);
        Assert.Equal("Oracle", partner.Name);
        Assert.Equal("Oracle.svg", partner.ImageFilename);
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
        var req = NewRequest();
        req.Name = "  AWS  ";
        req.ImageFilename = "   ";

        var res = await _client.PostAsJsonAsync(Url, req);
        var created = await res.Content.ReadFromJsonAsync<Partner>();

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        Assert.EndsWith($"{Url}/{created!.Pkid}", res.Headers.Location!.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal("AWS", created.Name);
        Assert.Null(created.ImageFilename);
        Assert.NotNull(await _factory.Partners.GetByIdAsync(created.Pkid));
    }

    [Fact]
    public async Task Create_DuplicateAppKey_Returns409()
    {
        var res = await _client.PostAsJsonAsync(Url, NewRequest(appKey: "MS"));

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Contains("已存在", await res.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("", "aws")]
    [InlineData("AWS", "")]
    [InlineData("AWS", "中文")]          // varchar — ASCII only
    [InlineData("AWS", "elevenchars")]  // > 10
    public async Task Create_InvalidRequiredField_Returns400(string name, string appKey)
    {
        var req = NewRequest(appKey: appKey);
        req.Name = name;

        var res = await _client.PostAsJsonAsync(Url, req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Create_MissingMenuName_Returns400()
    {
        var req = NewRequest();
        req.NameOnPartnerMenu = "";

        var res = await _client.PostAsJsonAsync(Url, req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // ---------- Edit ----------

    [Fact]
    public async Task Update_Existing_UpdatesFields()
    {
        var req = NewRequest(pkid: 2, appKey: "Oracle");
        req.Name = "Oracle Corp";
        req.DisplayOrder = 99;

        var res = await _client.PutAsJsonAsync(Url, req);
        var updated = await res.Content.ReadFromJsonAsync<Partner>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(2, updated!.Pkid);
        Assert.Equal("Oracle Corp", updated.Name);
        Assert.Equal(99, updated.DisplayOrder);
    }

    [Fact]
    public async Task Update_AppKeyOfAnotherPartner_Returns409()
    {
        var res = await _client.PutAsJsonAsync(Url, NewRequest(pkid: 2, appKey: "cisco"));

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    [Fact]
    public async Task Update_Missing_Returns404()
    {
        var res = await _client.PutAsJsonAsync(Url, NewRequest(pkid: 99));

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Update_WithoutPkid_Returns400()
    {
        var res = await _client.PutAsJsonAsync(Url, NewRequest());

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
    [InlineData(1)]   // courses + certifications
    [InlineData(3)]   // seminars only (no FK, still guarded)
    public async Task Delete_InUse_Returns409AndKeepsRow(short pkid)
    {
        var res = await _client.DeleteAsync($"{Url}/{pkid}");

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Contains("無法刪除", await res.Content.ReadAsStringAsync());
        Assert.NotNull(await _factory.Partners.GetByIdAsync(pkid));
    }

    [Fact]
    public async Task Delete_Missing_Returns404()
    {
        var res = await _client.DeleteAsync($"{Url}/99");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ---------- Lookup ----------

    [Fact]
    public async Task Lookup_ReturnsSlimList_OrderedByDisplayOrder()
    {
        var rows = await _client.GetFromJsonAsync<List<PartnerLookup>>("/api/lookups/partners");

        Assert.Equal(["Cisco", "Microsoft", "Oracle"], rows!.Select(p => p.Name));
    }
}
