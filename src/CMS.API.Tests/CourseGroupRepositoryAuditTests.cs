using CMS.API.Models;
using CMS.API.Repositories;
using Dapper;
using Microsoft.Data.SqlClient;

namespace CMS.API.Tests;

/// <summary>Real CourseGroupRepository SQL against the CMS database, rolled back after each test.</summary>
[Collection(DatabaseCollection.Name)]
public class CourseGroupRepositoryAuditTests
{
    private const string Table = "CourseGroup";

    private static CourseGroupRepository Repo(IRowAuditRepository? audits = null)
        => new(TestDatabase.Connections, TestDatabase.Writer("Carol", audits));

    [DatabaseFact]
    public async Task Create_writes_an_Insert_row_with_the_first_string_column()
    {
        using var scope = TestDatabase.BeginRollback();

        var pkid = await Repo().CreateAsync(new CourseGroupRequest { Description = "ZZ 稽核測試" });

        var row = Assert.Single(await TestDatabase.AuditsAsync(Table, pkid));
        Assert.Equal(("Insert", "ZZ 稽核測試", "Carol"), (row.ActionType, row.ActionDesc, row.UserName));
        Assert.Equal(pkid.ToString(), row.PrimaryKeyValues);
    }

    [DatabaseFact]
    public async Task Update_writes_an_Update_row_listing_the_changed_columns()
    {
        using var scope = TestDatabase.BeginRollback();
        var repo = Repo();
        var pkid = await repo.CreateAsync(new CourseGroupRequest { Description = "ZZ before" });

        Assert.True(await repo.UpdateAsync(new CourseGroupRequest { Pkid = pkid, Description = "ZZ after" }));
        Assert.True(await repo.UpdateAsync(new CourseGroupRequest { Pkid = pkid, Description = "ZZ after" }));

        var rows = await TestDatabase.AuditsAsync(Table, pkid);
        Assert.Equal(["Insert", "Update", "Update"], rows.Select(r => r.ActionType));
        Assert.Equal("Description", rows[1].ActionDesc);
        Assert.Equal(string.Empty, rows[2].ActionDesc ?? string.Empty); // saved unchanged: nothing listed
    }

    [DatabaseFact]
    public async Task Delete_writes_a_Delete_row_with_the_deleted_rows_first_string_column()
    {
        using var scope = TestDatabase.BeginRollback();
        var repo = Repo();
        var pkid = await repo.CreateAsync(new CourseGroupRequest { Description = "ZZ to delete" });

        Assert.True(await repo.DeleteAsync(pkid));

        var rows = await TestDatabase.AuditsAsync(Table, pkid);
        Assert.Equal(["Insert", "Delete"], rows.Select(r => r.ActionType));
        Assert.Equal("ZZ to delete", rows[1].ActionDesc);
        Assert.Null(await repo.GetByIdAsync(pkid));
    }

    [DatabaseFact]
    public async Task Missing_row_writes_no_audit_row()
    {
        using var scope = TestDatabase.BeginRollback();
        var repo = Repo();

        Assert.False(await repo.UpdateAsync(new CourseGroupRequest { Pkid = short.MaxValue, Description = "ZZ" }));
        Assert.False(await repo.DeleteAsync(short.MaxValue));

        Assert.Empty(await TestDatabase.AuditsAsync(Table, short.MaxValue));
    }

    // A rolled-back inner transaction aborts the whole ambient scope, so the failure tests use committed rows
    // and run only the failing call inside the scope, then assert on the committed state after it.

    [DatabaseFact]
    public async Task Failed_update_writes_no_audit_row()
    {
        var group = await FirstGroupAsync("1 = 1");
        var audits = (await TestDatabase.AuditsAsync(Table, group.Pkid)).Count;

        using (TestDatabase.BeginRollback())
        {
            // Description is nvarchar(100): SQL Server rejects the UPDATE (string truncation).
            await Assert.ThrowsAsync<SqlException>(() =>
                Repo().UpdateAsync(new CourseGroupRequest { Pkid = group.Pkid, Description = new string('Z', 101) }));
        }

        Assert.Equal(audits, (await TestDatabase.AuditsAsync(Table, group.Pkid)).Count);
        Assert.Equal(group.Description, (await Repo().GetByIdAsync(group.Pkid))!.Description);
    }

    [DatabaseFact]
    public async Task Failed_delete_writes_no_audit_row()
    {
        var group = await FirstGroupAsync("EXISTS (SELECT 1 FROM Course c WHERE c.CourseGroup_pkid = g.pkid)");
        var audits = (await TestDatabase.AuditsAsync(Table, group.Pkid)).Count;

        using (TestDatabase.BeginRollback())
        {
            // Course.CourseGroup_pkid FK: SQL Server rejects the DELETE.
            await Assert.ThrowsAsync<SqlException>(() => Repo().DeleteAsync(group.Pkid));
        }

        Assert.Equal(audits, (await TestDatabase.AuditsAsync(Table, group.Pkid)).Count);
        Assert.NotNull(await Repo().GetByIdAsync(group.Pkid));
    }

    [DatabaseFact]
    public async Task Failed_audit_insert_rolls_the_change_back()
    {
        var group = await FirstGroupAsync("1 = 1");
        var description = $"ZZ rollback {Guid.NewGuid():N}";

        using (TestDatabase.BeginRollback())
            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                Repo(new FailingRowAuditRepository()).CreateAsync(new CourseGroupRequest { Description = description }));
        using (TestDatabase.BeginRollback())
            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                Repo(new FailingRowAuditRepository()).UpdateAsync(new CourseGroupRequest { Pkid = group.Pkid, Description = description }));

        Assert.Empty(await Repo().QueryAsync(new CourseGroupQuery { Keyword = description }));
        Assert.Equal(group.Description, (await Repo().GetByIdAsync(group.Pkid))!.Description);
    }

    private static async Task<CourseGroup> FirstGroupAsync(string where)
    {
        using var conn = await TestDatabase.Connections.OpenAsync();
        var group = await conn.QueryFirstOrDefaultAsync<CourseGroup>(
            $"SELECT TOP 1 g.pkid, g.Description FROM CourseGroup g WHERE {where} ORDER BY g.pkid");
        Assert.NotNull(group);
        return group;
    }
}
