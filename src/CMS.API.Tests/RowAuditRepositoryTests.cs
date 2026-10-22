using System.Security.Claims;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Http;

namespace CMS.API.Tests;

/// <summary><see cref="RowAuditRepository.GetByRecordAsync"/> SQL against the real CMS database (rolled back).</summary>
[Collection(DatabaseCollection.Name)]
public class RowAuditRepositoryTests
{
    [DatabaseFact]
    public async Task GetByRecord_filters_by_table_and_pkid_newest_first()
    {
        using var scope = TestDatabase.BeginRollback();
        var repo = new RowAuditRepository(TestDatabase.Connections);
        async Task Add(string table, string pk, string action, DateTime at, string? desc) => await repo.InsertAsync(new RowAudit
        {
            TableName = table, PrimaryKeyValues = pk, ActionType = action, UserName = "ZZ 稽核", DateTime = at, ActionDesc = desc,
        });

        var at = new DateTime(2099, 1, 2, 9, 0, 0);
        await Add("ZZAuditA", "5", "Insert", at.AddDays(-1), "ZZ 名稱");
        await Add("ZZAuditA", "5", "Update", at, "Name");
        await Add("ZZAuditA", "5", "Delete", at, "ZZ 名稱 2");
        await Add("ZZAuditA", "50", "Update", at.AddDays(1), "Other");
        await Add("ZZAuditB", "5", "Update", at.AddDays(1), "Other");

        var rows = (await repo.GetByRecordAsync("ZZAuditA", "5")).ToList();

        Assert.Equal(["Delete", "Update", "Insert"], rows.Select(r => r.ActionType));
        Assert.Equal(["ZZ 名稱 2", "Name", "ZZ 名稱"], rows.Select(r => r.ActionDesc));
        Assert.Equal(at, rows[0].DateTime);
        Assert.All(rows, r => Assert.Equal("ZZ 稽核", r.UserName));
        Assert.Empty(await repo.GetByRecordAsync("ZZAuditA", "6"));
    }

    // Regression: ISSUE-003 — a name over 100 chars (AppUser.UserName allows 200) failed every audited write
    // Found by /qa on 2026-10-22
    // Report: .gstack/qa-reports/run-20261022T013931Z/qa-report-cms-api-2026-10-22.md
    [DatabaseFact]
    public async Task Writer_stores_a_200_character_user_name_in_the_real_column()
    {
        using var scope = TestDatabase.BeginRollback();
        var repo = new RowAuditRepository(TestDatabase.Connections);
        var http = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("name", new string('名', 200))], "Bearer")),
            },
        };

        await new RowAuditWriter(repo, http, TimeProvider.System)
            .LogInsertAsync("ZZAuditLongName", new CourseGroup { Pkid = 1, Description = "ZZ" });

        var row = Assert.Single(await repo.GetByRecordAsync("ZZAuditLongName", "1"));
        Assert.Equal(new string('名', 100), row.UserName);
    }
}
