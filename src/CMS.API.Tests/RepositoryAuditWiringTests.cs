using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Repositories;
using Dapper;

namespace CMS.API.Tests;

/// <summary>
/// Every audited repository write against the real CMS database (rolled back): one RowAudit row per change, with
/// the first string column for Insert/Delete and exactly the changed columns for Update.
/// The failure paths are covered once, in <see cref="CourseGroupRepositoryAuditTests"/>.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class RepositoryAuditWiringTests
{
    private static RowAuditWriter Writer => TestDatabase.Writer("Carol");

    [DatabaseFact]
    public async Task Partner_audits_insert_update_delete()
    {
        using var scope = TestDatabase.BeginRollback();
        var repo = new PartnerRepository(TestDatabase.Connections, Writer);
        var request = new PartnerRequest
        {
            Name = "ZZ 原廠", AppKey = "zzaudit", NameOnPartnerMenu = "ZZ menu", NameOnCourseDetailPage = "ZZ page", DisplayOrder = 1,
        };

        var pkid = await repo.CreateAsync(request);
        request.Pkid = pkid;
        request.Name = "ZZ 原廠 2";
        request.DisplayOrder = 2;
        await repo.UpdateAsync(request);
        await repo.DeleteAsync(pkid);

        await AssertAuditsAsync("Partner", pkid, ("Insert", "ZZ 原廠"), ("Update", "Name,DisplayOrder"), ("Delete", "ZZ 原廠 2"));
    }

    [DatabaseFact]
    public async Task PublishStatus_audits_insert_update_delete()
    {
        using var scope = TestDatabase.BeginRollback();
        var repo = new PublishStatusRepository(TestDatabase.Connections, Writer);
        var pkid = await UnusedPublishStatusPkidAsync();
        var request = new PublishStatusRequest { Pkid = pkid, Description = "ZZ 狀態" };

        await repo.CreateAsync(request);
        request.IsDraft = true;
        request.IsPublished = true;
        await repo.UpdateAsync(request);
        await repo.DeleteAsync(pkid);

        await AssertAuditsAsync("PublishStatus", pkid, ("Insert", "ZZ 狀態"), ("Update", "IsDraft,IsPublished"), ("Delete", "ZZ 狀態"));
    }

    [DatabaseFact]
    public async Task AppRole_audits_insert_update_delete()
    {
        using var scope = TestDatabase.BeginRollback();
        var repo = new AppRoleRepository(TestDatabase.Connections, Writer);
        var request = new AppRoleRequest { RoleId = "ZZaudit", RoleName = "ZZ 角色", PermissionLevel = 100 };

        var pkid = await repo.CreateAsync(request);
        request.Pkid = pkid;
        request.RoleName = "ZZ 角色 2";
        request.PermissionLevel = 200;
        await repo.UpdateAsync(request);
        await repo.DeleteAsync(pkid);

        await AssertAuditsAsync("AppRole", pkid, ("Insert", "ZZaudit"), ("Update", "RoleName,PermissionLevel"), ("Delete", "ZZaudit"));
    }

    [DatabaseFact]
    public async Task AppUser_audits_insert_update_side_actions_delete()
    {
        using var scope = TestDatabase.BeginRollback();
        var repo = new AppUserRepository(TestDatabase.Connections, Writer);
        var auth = new AuthRepository(TestDatabase.Connections, Writer);
        var request = new AppUserRequest { UserId = "ZZaudit", UserName = "ZZ 使用者", IsActive = true };
        var now = new DateTime(2099, 1, 1, 9, 0, 0);

        var pkid = await repo.CreateAsync(request, "hash-1");
        request.Pkid = pkid;
        request.UserName = "ZZ 使用者 2";
        request.IsActive = false;
        await repo.UpdateAsync(request);
        await repo.ResetPasswordAsync(pkid, "hash-2", now);
        await repo.SetAgentTokenHashAsync(pkid, "token-hash");
        await auth.UpdateUserNameAsync("ZZaudit", "ZZ 使用者 3");
        await auth.UpdatePasswordAsync("ZZaudit", "hash-3", now.AddDays(1));
        await repo.DeleteAsync(pkid);

        await AssertAuditsAsync("AppUser", pkid,
            ("Insert", "ZZaudit"),
            ("Update", "UserName,IsActive"),
            ("Update", "PasswordUpdatedTime,PasswordHash"),
            ("Update", "AgentTokenHash"),
            ("Update", "UserName"),
            ("Update", "PasswordUpdatedTime,PasswordHash"),
            ("Delete", "ZZaudit"));
    }

    [DatabaseFact]
    public async Task Course_audits_insert_update_delete()
    {
        using var scope = TestDatabase.BeginRollback();
        var repo = new CourseRepository(TestDatabase.Connections, Writer);
        var (partnerPkid, publishStatusPkid) = await FirstAsync<(short, byte)>(
            "SELECT (SELECT MIN(pkid) FROM Partner), (SELECT MIN(pkid) FROM PublishStatus)");
        var request = new CourseRequest
        {
            Title = "ZZ 稽核課程", CourseId = "ZZAUDIT", ProdCourseId = "ZZAUDIT", FriendlyUrl = "zz-audit",
            PartnerPkid = partnerPkid, PublishStatusPkid = publishStatusPkid,
            ScheduleOn = new DateOnly(2099, 1, 1), ScheduleOff = new DateOnly(2099, 12, 31), ListPrice = 1000m,
        };

        var pkid = await repo.CreateAsync(request);
        request.Pkid = pkid;
        request.Title = "ZZ 稽核課程 2";
        request.ListPrice = 1200m;
        await repo.UpdateAsync(request);
        await repo.DeleteAsync(pkid);

        await AssertAuditsAsync("Course", pkid, ("Insert", "ZZ 稽核課程"), ("Update", "Title,ListPrice"), ("Delete", "ZZ 稽核課程 2"));
    }

    [DatabaseFact]
    public async Task FeaturedPromoItem_audits_insert_update_delete()
    {
        using var scope = TestDatabase.BeginRollback();
        var repo = new FeaturedPromoItemRepository(TestDatabase.Connections, Writer);
        var (trainingCenterPkid, promotionPkid) = await FirstAsync<(short, int)>(
            "SELECT (SELECT MIN(pkid) FROM TrainingCenter), (SELECT MIN(pkid) FROM Promotion2)");
        var request = new FeaturedPromoItemRequest
        {
            ScheduleOn = new DateOnly(2099, 1, 1), TrainingCenterPkid = trainingCenterPkid, Slot = 1,
            PromotionPkid = promotionPkid, Topic = "ZZ 主題", Description = "ZZ 說明",
        };

        var pkid = await repo.CreateAsync(request);
        request.Pkid = pkid;
        request.Slot = 2;
        request.Topic = "ZZ 主題 2";
        await repo.UpdateAsync(request);
        await repo.DeleteAsync(pkid);

        await AssertAuditsAsync("FeaturedPromoItem", pkid, ("Insert", "ZZ 主題"), ("Update", "Slot,Topic"), ("Delete", "ZZ 主題 2"));
    }

    private static async Task AssertAuditsAsync(string table, object pkid, params (string ActionType, string ActionDesc)[] expected)
    {
        var rows = await TestDatabase.AuditsAsync(table, pkid);
        Assert.Equal(expected, rows.Select(r => (r.ActionType, r.ActionDesc ?? string.Empty)));
        Assert.All(rows, r => Assert.Equal("Carol", r.UserName));
    }

    private static async Task<byte> UnusedPublishStatusPkidAsync()
        => await FirstAsync<byte>("SELECT TOP 1 v.n FROM (SELECT TOP 255 CAST(256 - ROW_NUMBER() OVER (ORDER BY object_id) AS tinyint) AS n FROM sys.all_objects) v WHERE NOT EXISTS (SELECT 1 FROM PublishStatus s WHERE s.pkid = v.n)");

    private static async Task<T> FirstAsync<T>(string sql)
    {
        using var conn = await TestDatabase.Connections.OpenAsync();
        return await conn.QueryFirstAsync<T>(sql);
    }
}
