using System.Net;
using System.Net.Http.Json;
using CMS.API.Models;

namespace CMS.API.Tests;

public class CoursesControllerTests : IDisposable
{
    private const string Url = "/api/courses";
    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public CoursesControllerTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    private static CourseRequest NewRequest(int pkid = 0, string courseId = "AZ900") => new()
    {
        Pkid = pkid,
        Title = "Azure 基礎",
        CourseId = courseId,
        ProdCourseId = "AZ-900",
        FriendlyUrl = "az-900",
        DisplayOrder = 5,
        PartnerPkid = 1,
        CourseGroupPkid = 10,
        PublishStatusPkid = 1,
        ScheduleOn = new DateOnly(2026, 1, 1),
        ScheduleOff = new DateOnly(2027, 12, 31),
        Hour = 7,
        ListPrice = 9000,
        LearningCredit = 1.5m,
        CanRepeat = true,
        Outline = "第一章",
        CertificationPkids = [1, 2, 2],
        JobCategoryPkids = [1],
    };

    // ---------- List ----------

    [Fact]
    public async Task GetAll_ReturnsAll_OrderedByDisplayOrderThenPkidDesc_WithoutLongTexts()
    {
        var rows = await _client.GetFromJsonAsync<List<Course>>(Url);

        Assert.NotNull(rows);
        Assert.Equal([3, 2, 1], rows.Select(c => c.Pkid));
        var az = rows.Single(c => c.Pkid == 1);
        Assert.Equal("Microsoft", az.PartnerName);
        Assert.Equal("Azure", az.CourseGroupDescription);
        Assert.Equal("上架中", az.PublishStatusDescription);
        Assert.Null(az.Outline);
        Assert.Empty(az.Certifications);
    }

    // ---------- Query / filter ----------

    [Theory]
    [InlineData("az104", 1)]          // CourseId
    [InlineData("Cisco Solutions", 2)] // OfficialTitle
    [InlineData("ai-9", 3)]           // ProdCourseId / FriendlyUrl
    [InlineData("網路", 2)]            // Title
    public async Task Query_ByKeyword_MatchesStringColumns(string keyword, int expectedPkid)
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new CourseQuery { Keyword = keyword });
        var rows = await res.Content.ReadFromJsonAsync<List<Course>>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(expectedPkid, Assert.Single(rows!).Pkid);
    }

    [Fact]
    public async Task Query_ByFks_ReturnsMatching()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query",
            new CourseQuery { PartnerPkid = 1, CourseGroupPkid = 10, PublishStatusPkid = 3 });
        var rows = await res.Content.ReadFromJsonAsync<List<Course>>();

        Assert.Equal(3, Assert.Single(rows!).Pkid);
    }

    [Fact]
    public async Task Query_ByCanRepeat_ReturnsMatching()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new CourseQuery { CanRepeat = true });
        var rows = await res.Content.ReadFromJsonAsync<List<Course>>();

        Assert.Equal(1, Assert.Single(rows!).Pkid);
    }

    [Fact]
    public async Task Query_ByDateRanges_IsInclusive()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new CourseQuery
        {
            ScheduleOnFrom = new DateOnly(2025, 1, 1),
            ScheduleOffTo = new DateOnly(2026, 12, 31),
        });
        var rows = await res.Content.ReadFromJsonAsync<List<Course>>();

        Assert.Equal(2, Assert.Single(rows!).Pkid);
    }

    [Fact]
    public async Task Query_EmptyFilter_ReturnsAll()
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", new CourseQuery());
        var rows = await res.Content.ReadFromJsonAsync<List<Course>>();

        Assert.Equal(3, rows!.Count);
    }

    // ---------- View ----------

    [Fact]
    public async Task GetById_Existing_ReturnsFullCourse()
    {
        var course = await _client.GetFromJsonAsync<Course>($"{Url}/1");

        Assert.NotNull(course);
        Assert.Equal("AZ104", course.CourseId);
        Assert.Equal("大綱", course.Outline);
        Assert.Equal(new DateOnly(2027, 12, 31), course.ScheduleOff);
        Assert.Equal(4.5m, course.LearningCredit);
        Assert.Equal("Azure Administrator", Assert.Single(course.Certifications).Title);
        Assert.Equal("系統管理", Assert.Single(course.JobCategories).Description);
    }

    [Fact]
    public async Task GetByIdAndList_ReturnPublishStatusIsPublished()
    {
        var published = await _client.GetFromJsonAsync<Course>($"{Url}/1"); // status 2 上架中
        var draft = await _client.GetFromJsonAsync<Course>($"{Url}/2");     // status 1 草稿
        var rows = await _client.GetFromJsonAsync<List<Course>>(Url);

        Assert.True(published!.PublishStatusIsPublished);
        Assert.False(draft!.PublishStatusIsPublished);
        Assert.True(rows!.Single(c => c.Pkid == 1).PublishStatusIsPublished);
    }

    [Fact]
    public async Task PublishStatusIsPublished_FollowsTheStatusRowFlag_NotThePkid()
    {
        await _factory.PublishStatuses.UpdateAsync(
            new PublishStatusRequest { Pkid = 2, Description = "上架中", IsPublished = false });

        var course = await _client.GetFromJsonAsync<Course>($"{Url}/1");

        Assert.Equal(2, course!.PublishStatusPkid);
        Assert.False(course.PublishStatusIsPublished);
    }

    [Theory]
    [InlineData(99)]
    [InlineData(0)]
    public async Task GetById_Missing_Returns404(int id)
    {
        var res = await _client.GetAsync($"{Url}/{id}");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ---------- Add ----------

    [Fact]
    public async Task Create_Valid_Returns201_TrimsAndDedupesLinks()
    {
        var req = NewRequest();
        req.Title = "  Azure 基礎  ";
        req.OfficialTitle = "   ";

        var res = await _client.PostAsJsonAsync(Url, req);
        var created = await res.Content.ReadFromJsonAsync<Course>();

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        Assert.EndsWith($"{Url}/{created!.Pkid}", res.Headers.Location!.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Azure 基礎", created.Title);
        Assert.Null(created.OfficialTitle);
        Assert.Equal("Microsoft", created.PartnerName);
        Assert.Equal([1, 2], created.Certifications.Select(c => c.Pkid));
        Assert.Equal([(short)1], created.JobCategories.Select(j => j.Pkid));
    }

    [Fact]
    public async Task Create_WithoutCourseGroup_IsAllowed()
    {
        var req = NewRequest();
        req.CourseGroupPkid = null;

        var res = await _client.PostAsJsonAsync(Url, req);
        var created = await res.Content.ReadFromJsonAsync<Course>();

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        Assert.Null(created!.CourseGroupPkid);
    }

    [Fact]
    public async Task Create_DuplicateCourseId_Returns409()
    {
        var res = await _client.PostAsJsonAsync(Url, NewRequest(courseId: "az104"));

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Contains("已存在", await res.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("title")]
    [InlineData("courseIdBlank")]
    [InlineData("courseIdNonAscii")]
    [InlineData("prodCourseIdTooLong")]
    [InlineData("friendlyUrl")]
    [InlineData("partner0")]
    [InlineData("publishStatus0")]
    [InlineData("scheduleOnNull")]
    [InlineData("negativeHour")]
    public async Task Create_InvalidField_Returns400(string kase)
    {
        var req = NewRequest();
        switch (kase)
        {
            case "title": req.Title = ""; break;
            case "courseIdBlank": req.CourseId = ""; break;
            case "courseIdNonAscii": req.CourseId = "課程"; break;
            case "prodCourseIdTooLong": req.ProdCourseId = new string('x', 51); break;
            case "friendlyUrl": req.FriendlyUrl = ""; break;
            case "partner0": req.PartnerPkid = 0; break;
            case "publishStatus0": req.PublishStatusPkid = 0; break;
            case "scheduleOnNull": req.ScheduleOn = null; break;
            case "negativeHour": req.Hour = -1; break;
        }

        var res = await _client.PostAsJsonAsync(Url, req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Theory]
    [InlineData("scheduleOffBeforeOn", "下架日期")]
    [InlineData("listPriceFraction", "定價")]
    [InlineData("creditTwoDecimals", "點數")]
    [InlineData("unknownPartner", "原廠")]
    [InlineData("unknownCourseGroup", "課程群組")]
    [InlineData("unknownPublishStatus", "上架狀態")]
    [InlineData("unknownCertification", "認證")]
    [InlineData("unknownJobCategory", "職務類別")]
    public async Task Create_BusinessRuleViolation_Returns400WithMessage(string kase, string expected)
    {
        var req = NewRequest();
        switch (kase)
        {
            case "scheduleOffBeforeOn": req.ScheduleOff = new DateOnly(2025, 12, 31); break;
            case "listPriceFraction": req.ListPrice = 100.5m; break;
            case "creditTwoDecimals": req.LearningCredit = 1.25m; break;
            case "unknownPartner": req.PartnerPkid = 99; break;
            case "unknownCourseGroup": req.CourseGroupPkid = 99; break;
            case "unknownPublishStatus": req.PublishStatusPkid = 99; break;
            case "unknownCertification": req.CertificationPkids = [1, 99]; break;
            case "unknownJobCategory": req.JobCategoryPkids = [99]; break;
        }

        var res = await _client.PostAsJsonAsync(Url, req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains(expected, await res.Content.ReadAsStringAsync());
    }

    // ---------- Edit ----------

    [Fact]
    public async Task Update_Existing_UpdatesFieldsAndLinks()
    {
        var req = NewRequest(pkid: 2, courseId: "CCNA2");
        req.Title = "CCNA 進階";
        req.CertificationPkids = [2];
        req.JobCategoryPkids = [];

        var res = await _client.PutAsJsonAsync(Url, req);
        var updated = await res.Content.ReadFromJsonAsync<Course>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(2, updated!.Pkid);
        Assert.Equal("CCNA2", updated.CourseId);
        Assert.Equal("CCNA 進階", updated.Title);
        Assert.Equal(2, Assert.Single(updated.Certifications).Pkid);
        Assert.Empty(updated.JobCategories);
    }

    [Fact]
    public async Task Update_KeepingOwnCourseId_IsAllowed()
    {
        var res = await _client.PutAsJsonAsync(Url, NewRequest(pkid: 1, courseId: "AZ104"));

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Update_CourseIdOfAnotherCourse_Returns409()
    {
        var res = await _client.PutAsJsonAsync(Url, NewRequest(pkid: 2, courseId: "AI900"));

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
    [InlineData(1)]   // FAQ
    [InlineData(3)]   // hot course
    public async Task Delete_InUse_Returns409AndKeepsRow(int pkid)
    {
        var res = await _client.DeleteAsync($"{Url}/{pkid}");

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Contains("無法刪除", await res.Content.ReadAsStringAsync());
        Assert.NotNull(await _factory.Courses.GetByIdAsync(pkid));
    }

    [Fact]
    public async Task Delete_Missing_Returns404()
    {
        var res = await _client.DeleteAsync($"{Url}/99");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ---------- Lookups ----------

    [Fact]
    public async Task CourseLookup_ReturnsSlimList_OrderedByCourseId()
    {
        var rows = await _client.GetFromJsonAsync<List<CourseLookup>>("/api/lookups/courses");

        Assert.Equal(["AI900", "AZ104", "CCNA"], rows!.Select(c => c.CourseId));
    }

    [Fact]
    public async Task CertificationLookup_ReturnsTitleAndPartner()
    {
        var rows = await _client.GetFromJsonAsync<List<CertificationLookup>>("/api/lookups/certifications");

        Assert.Equal(2, rows!.Count);
        Assert.Equal("Microsoft", rows[0].PartnerName);
    }

    [Fact]
    public async Task JobCategoryLookup_ReturnsAll()
    {
        var rows = await _client.GetFromJsonAsync<List<JobCategoryLookup>>("/api/lookups/job-categories");

        Assert.Equal(2, rows!.Count);
    }
}
