using System.Security.Claims;
using CMS.API.Data;
using CMS.API.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace CMS.API.Tests;

public class RowAuditWriterTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 20, 1, 30, 0, TimeSpan.Zero);

    private readonly FakeRowAuditRepository _audits = new();
    private readonly HttpContextAccessor _http = new();

    private RowAuditWriter Writer() => new(_audits, _http, new FixedTimeProvider(Now));

    private void SignIn(string? userName, string authenticationType = "Bearer")
    {
        var claims = new List<Claim> { new("sub", "carol") };
        if (userName is not null) claims.Add(new Claim("name", userName));
        _http.HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, authenticationType)) };
    }

    private RowAudit Single() => Assert.Single(_audits.Rows);

    private static Course SampleCourse() => new()
    {
        Pkid = 42,
        Title = "Azure 管理",
        CourseId = "AZ-104",
        DisplayOrder = 1,
        ScheduleOn = new DateOnly(2026, 1, 1),
        ListPrice = 1000m,
        Certifications = [new CertificationLookup { Pkid = 1, Title = "Azure Admin", PartnerName = "Microsoft" }],
    };

    private static Course Clone(Course c) => new()
    {
        Pkid = c.Pkid,
        Title = c.Title,
        CourseId = c.CourseId,
        DisplayOrder = c.DisplayOrder,
        ScheduleOn = c.ScheduleOn,
        ListPrice = c.ListPrice,
        Certifications = c.Certifications
            .Select(x => new CertificationLookup { Pkid = x.Pkid, Title = x.Title, PartnerName = x.PartnerName }).ToList(),
    };

    [Fact]
    public async Task LogInsert_writes_first_string_property_pkid_user_and_taipei_time()
    {
        SignIn("Carol");

        await Writer().LogInsertAsync("Course", SampleCourse());

        var row = Single();
        Assert.Equal("Course", row.TableName);
        Assert.Equal("Insert", row.ActionType);
        Assert.Equal("Azure 管理", row.ActionDesc);
        Assert.Equal("42", row.PrimaryKeyValues);
        Assert.Equal("Carol", row.UserName);
        Assert.Equal(new DateTime(2026, 10, 20, 9, 30, 0), row.DateTime);
    }

    [Fact]
    public async Task LogDelete_writes_first_string_property_of_the_deleted_entity()
    {
        SignIn("Carol");

        await Writer().LogDeleteAsync("Partner", new Partner { Pkid = 7, Name = "Cisco", AppKey = "cisco" });

        var row = Single();
        Assert.Equal("Delete", row.ActionType);
        Assert.Equal("Cisco", row.ActionDesc);
        Assert.Equal("7", row.PrimaryKeyValues);
    }

    [Fact]
    public async Task Null_first_string_property_writes_null_ActionDesc()
    {
        await Writer().LogInsertAsync("Thing", new NoNameEntity { Pkid = 1, Count = 5 });

        Assert.Null(Single().ActionDesc);
    }

    [Fact]
    public async Task LogUpdate_lists_exactly_the_changed_property_names_in_declaration_order()
    {
        SignIn("Carol");
        var before = SampleCourse();
        var after = Clone(before);
        after.ListPrice = 1200m;
        after.Title = "Azure 管理（新版）";
        after.CourseGroupPkid = 5;

        await Writer().LogUpdateAsync("Course", before, after);

        var row = Single();
        Assert.Equal("Update", row.ActionType);
        Assert.Equal("Title,CourseGroupPkid,ListPrice", row.ActionDesc);
        Assert.Equal("42", row.PrimaryKeyValues);
    }

    [Fact]
    public async Task LogUpdate_writes_empty_ActionDesc_when_nothing_changed()
    {
        var before = SampleCourse();

        await Writer().LogUpdateAsync("Course", before, Clone(before));

        Assert.Equal(string.Empty, Single().ActionDesc);
    }

    [Fact]
    public async Task LogUpdate_compares_collections_by_content()
    {
        var before = SampleCourse();
        var after = Clone(before);
        after.Certifications.Add(new CertificationLookup { Pkid = 2, Title = "Azure Architect" });
        after.JobCategories = [];

        await Writer().LogUpdateAsync("Course", before, after);

        Assert.Equal("Certifications", Single().ActionDesc);
    }

    [Fact]
    public async Task PrimaryKeyValues_reads_pkid_of_any_numeric_type()
    {
        await Writer().LogInsertAsync("PublishStatus", new PublishStatus { Pkid = 2, Description = "上架" });
        await Writer().LogInsertAsync("AppUser", new AppUser { Pkid = 123456, UserId = "carol" });

        Assert.Equal(["2", "123456"], _audits.Rows.Select(r => r.PrimaryKeyValues));
    }

    [Fact]
    public async Task Entity_without_pkid_throws()
    {
        await Assert.ThrowsAsync<ArgumentException>(() => Writer().LogInsertAsync("Thing", new { Name = "x" }));
        Assert.Empty(_audits.Rows);
    }

    [Fact]
    public async Task UserName_is_system_without_an_http_context()
    {
        await Writer().LogInsertAsync("CourseGroup", new CourseGroup { Pkid = 1, Description = "x" });

        Assert.Equal("system", Single().UserName);
    }

    [Fact]
    public async Task UserName_is_system_for_an_unauthenticated_user()
    {
        _http.HttpContext = new DefaultHttpContext();

        await Writer().LogInsertAsync("CourseGroup", new CourseGroup { Pkid = 1, Description = "x" });

        Assert.Equal("system", Single().UserName);
    }

    [Fact]
    public async Task UserName_is_system_when_the_token_has_no_name_claim()
    {
        SignIn(userName: null);

        await Writer().LogInsertAsync("CourseGroup", new CourseGroup { Pkid = 1, Description = "x" });

        Assert.Equal("system", Single().UserName);
    }

    // Regression: ISSUE-003 — a name over 100 chars (AppUser.UserName allows 200) failed every audited write
    // Found by /qa on 2026-10-22
    // Report: .gstack/qa-reports/run-20261022T013931Z/qa-report-cms-api-2026-10-22.md
    [Fact]
    public async Task UserName_is_truncated_to_the_100_character_column()
    {
        SignIn(new string('名', 150));

        await Writer().LogInsertAsync("CourseGroup", new CourseGroup { Pkid = 1, Description = "x" });

        Assert.Equal(new string('名', 100), Single().UserName);
    }

    [Fact]
    public async Task UserName_truncation_never_splits_a_surrogate_pair()
    {
        // nvarchar(100) holds 100 UTF-16 code units: "𠀀" takes two, so it can't start at unit 100.
        SignIn(new string('a', 99) + "𠀀b");

        await Writer().LogInsertAsync("CourseGroup", new CourseGroup { Pkid = 1, Description = "x" });

        Assert.Equal(new string('a', 99), Single().UserName);
    }

    [Fact]
    public async Task UserName_of_exactly_100_characters_is_kept()
    {
        SignIn(new string('a', 100));

        await Writer().LogInsertAsync("CourseGroup", new CourseGroup { Pkid = 1, Description = "x" });

        Assert.Equal(100, Single().UserName.Length);
    }

    [Fact]
    public async Task ActionDesc_is_truncated_to_1000_characters_of_ascii()
    {
        await Writer().LogInsertAsync("CourseGroup", new CourseGroup { Pkid = 1, Description = new string('a', 1500) });

        Assert.Equal(new string('a', 1000), Single().ActionDesc);
    }

    [Fact]
    public async Task ActionDesc_of_exactly_1000_characters_is_kept()
    {
        await Writer().LogInsertAsync("CourseGroup", new CourseGroup { Pkid = 1, Description = new string('a', 1000) });

        Assert.Equal(1000, Single().ActionDesc!.Length);
    }

    [Fact]
    public async Task ActionDesc_truncation_counts_chinese_as_two_bytes_without_splitting_a_character()
    {
        // varchar(1000) in a Chinese_Taiwan collation holds 1000 Big5 bytes: 499 Chinese chars after the leading "a".
        await Writer().LogInsertAsync("CourseGroup", new CourseGroup { Pkid = 1, Description = "a" + new string('課', 600) });

        Assert.Equal("a" + new string('課', 499), Single().ActionDesc);
    }

    [Fact]
    public async Task Update_list_longer_than_1000_is_truncated()
    {
        var before = new WideEntity { Pkid = 1 };
        var after = new WideEntity { Pkid = 1 };
        foreach (var p in typeof(WideEntity).GetProperties().Where(p => p.PropertyType == typeof(int) && p.Name != "Pkid"))
            p.SetValue(after, 1);

        await Writer().LogUpdateAsync("Wide", before, after);

        var desc = Single().ActionDesc!;
        Assert.Equal(1000, desc.Length);
        Assert.StartsWith("AVeryLongPropertyNameNumber01,AVeryLongPropertyNameNumber02,", desc);
    }

    private static AuditRow Row(string? topic, string description, byte slot) => new([
        new AuditColumn("pkid", typeof(int), 7),
        new AuditColumn("Slot", typeof(byte), slot),
        new AuditColumn("Topic", typeof(string), topic),
        new AuditColumn("Description", typeof(string), description),
    ]);

    [Fact]
    public async Task AuditRow_first_string_column_is_found_by_type_even_when_null()
    {
        await Writer().LogInsertAsync("FeaturedPromoItem", Row(null, "說明", 1));

        var row = Single();
        Assert.Null(row.ActionDesc);
        Assert.Equal("7", row.PrimaryKeyValues);
    }

    [Fact]
    public async Task AuditRow_update_lists_the_changed_column_names_in_table_order()
    {
        await Writer().LogUpdateAsync("FeaturedPromoItem", Row("主題", "說明", 1), Row("主題 2", "說明", 2));

        Assert.Equal("Slot,Topic", Single().ActionDesc);
    }

    [Fact]
    public async Task Writer_is_registered_and_reads_the_current_request_user()
    {
        using var factory = new CmsApiFactory();
        using var scope = factory.Services.CreateScope();
        var accessor = scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>();
        accessor.HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("name", "Alice")], "Bearer")),
        };

        await scope.ServiceProvider.GetRequiredService<RowAuditWriter>()
            .LogDeleteAsync("CourseGroup", new CourseGroup { Pkid = 9, Description = "Old" });

        var row = Assert.Single(factory.RowAudits.Rows);
        Assert.Equal(("Alice", "9", "Old"), (row.UserName, row.PrimaryKeyValues, row.ActionDesc));
    }

    private sealed class NoNameEntity
    {
        public int Pkid { get; set; }
        public int Count { get; set; }
        public string? Name { get; set; }
    }

    /// <summary>40 int properties with 29-char names: the changed list is 40 × 30 − 1 = 1199 characters.</summary>
    private sealed class WideEntity
    {
        public int Pkid { get; set; }
        public int AVeryLongPropertyNameNumber01 { get; set; }
        public int AVeryLongPropertyNameNumber02 { get; set; }
        public int AVeryLongPropertyNameNumber03 { get; set; }
        public int AVeryLongPropertyNameNumber04 { get; set; }
        public int AVeryLongPropertyNameNumber05 { get; set; }
        public int AVeryLongPropertyNameNumber06 { get; set; }
        public int AVeryLongPropertyNameNumber07 { get; set; }
        public int AVeryLongPropertyNameNumber08 { get; set; }
        public int AVeryLongPropertyNameNumber09 { get; set; }
        public int AVeryLongPropertyNameNumber10 { get; set; }
        public int AVeryLongPropertyNameNumber11 { get; set; }
        public int AVeryLongPropertyNameNumber12 { get; set; }
        public int AVeryLongPropertyNameNumber13 { get; set; }
        public int AVeryLongPropertyNameNumber14 { get; set; }
        public int AVeryLongPropertyNameNumber15 { get; set; }
        public int AVeryLongPropertyNameNumber16 { get; set; }
        public int AVeryLongPropertyNameNumber17 { get; set; }
        public int AVeryLongPropertyNameNumber18 { get; set; }
        public int AVeryLongPropertyNameNumber19 { get; set; }
        public int AVeryLongPropertyNameNumber20 { get; set; }
        public int AVeryLongPropertyNameNumber21 { get; set; }
        public int AVeryLongPropertyNameNumber22 { get; set; }
        public int AVeryLongPropertyNameNumber23 { get; set; }
        public int AVeryLongPropertyNameNumber24 { get; set; }
        public int AVeryLongPropertyNameNumber25 { get; set; }
        public int AVeryLongPropertyNameNumber26 { get; set; }
        public int AVeryLongPropertyNameNumber27 { get; set; }
        public int AVeryLongPropertyNameNumber28 { get; set; }
        public int AVeryLongPropertyNameNumber29 { get; set; }
        public int AVeryLongPropertyNameNumber30 { get; set; }
        public int AVeryLongPropertyNameNumber31 { get; set; }
        public int AVeryLongPropertyNameNumber32 { get; set; }
        public int AVeryLongPropertyNameNumber33 { get; set; }
        public int AVeryLongPropertyNameNumber34 { get; set; }
        public int AVeryLongPropertyNameNumber35 { get; set; }
        public int AVeryLongPropertyNameNumber36 { get; set; }
        public int AVeryLongPropertyNameNumber37 { get; set; }
        public int AVeryLongPropertyNameNumber38 { get; set; }
        public int AVeryLongPropertyNameNumber39 { get; set; }
        public int AVeryLongPropertyNameNumber40 { get; set; }
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
    }
}
