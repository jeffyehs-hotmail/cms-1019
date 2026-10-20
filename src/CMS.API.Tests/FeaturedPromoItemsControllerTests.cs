using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CMS.API.Models;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CMS.API.Tests;

public class FeaturedPromoItemsControllerTests : IDisposable
{
    private const string Url = "/api/featured-promo-items";
    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public FeaturedPromoItemsControllerTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    private static FeaturedPromoItemRequest NewRequest(int pkid = 0, byte slot = 1) => new()
    {
        Pkid = pkid,
        ScheduleOn = new DateOnly(2026, 3, 17),
        TrainingCenterPkid = 1,
        Slot = slot,
        PromotionPkid = 104,
        Topic = "教你把AI變成實戰力",
        Description = "用GitHub Copilot",
    };

    private async Task<List<FeaturedPromoItem>> QueryAsync(object body)
    {
        var res = await _client.PostAsJsonAsync($"{Url}/query", body);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<List<FeaturedPromoItem>>())!;
    }

    private static async Task<string?> MessageOf(HttpResponseMessage res)
        => (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString();

    // ---------- One-week ScheduleOn filter ----------

    [Theory]
    [InlineData("2026-03-16")] // Monday
    [InlineData("2026-03-18")] // Wednesday
    [InlineData("2026-03-22")] // Sunday
    public async Task Query_ReturnsMondayToSundayOfTheGivenDate(string weekOf)
    {
        var rows = await QueryAsync(new { trainingCenterPkid = 1, weekOf });

        // Excludes the previous Sunday (pkid 6) and the next Monday (pkid 5).
        Assert.Equal([1, 2, 3, 4], rows.Select(r => r.Pkid));
    }

    [Fact]
    public async Task Query_NextWeek_StartsOnMonday()
    {
        var rows = await QueryAsync(new { trainingCenterPkid = 1, weekOf = "2026-03-29" });
        Assert.Equal(5, Assert.Single(rows).Pkid);
    }

    [Fact]
    public async Task Query_WithoutWeekOf_UsesTheCurrentWeek()
    {
        using var factory = _factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<TimeProvider>();
            s.AddSingleton<TimeProvider>(new FixedTimeProvider(new DateTimeOffset(2026, 3, 19, 10, 0, 0, TimeSpan.Zero)));
        }));
        var res = await factory.CreateClient().PostAsJsonAsync($"{Url}/query", new { trainingCenterPkid = 1 });
        var rows = await res.Content.ReadFromJsonAsync<List<FeaturedPromoItem>>();

        Assert.Equal([1, 2, 3, 4], rows!.Select(r => r.Pkid));
    }

    [Fact]
    public async Task Query_ReturnsJoinedLabels_OrderedByDateAndSlot()
    {
        var rows = await QueryAsync(new { trainingCenterPkid = 1, weekOf = "2026-03-16" });

        Assert.Equal([1, 2, 3], rows.Take(3).Select(r => (int)r.Slot));
        var first = rows[0];
        Assert.Equal(new DateOnly(2026, 3, 16), first.ScheduleOn);
        Assert.Equal("台北", first.TrainingCenterName);
        Assert.Equal("20251204_SkillTrainAI", first.PromoCode);
        Assert.Equal("成為能AI協作的程式設計師", first.Topic);
    }

    // ---------- TrainingCenter filter ----------

    [Fact]
    public async Task Query_ByTrainingCenter_ReturnsOnlyThatCenter()
    {
        var rows = await QueryAsync(new { trainingCenterPkid = 2, weekOf = "2026-03-16" });

        Assert.Equal(7, Assert.Single(rows).Pkid);
        Assert.Equal("新竹", rows[0].TrainingCenterName);
    }

    [Fact]
    public async Task Query_WithoutTrainingCenter_ReturnsAllCenters()
    {
        var rows = await QueryAsync(new { weekOf = "2026-03-16" });
        Assert.Equal([1, 2, 3, 7, 4], rows.Select(r => r.Pkid));
    }

    [Fact]
    public async Task Query_CenterWithNoRows_ReturnsEmpty()
    {
        var rows = await QueryAsync(new { trainingCenterPkid = 54, weekOf = "2026-03-16" });
        Assert.Empty(rows);
    }

    // ---------- Get by id ----------

    [Fact]
    public async Task GetById_Found()
    {
        var item = await _client.GetFromJsonAsync<FeaturedPromoItem>($"{Url}/2");
        Assert.Equal("251211_GoogleAI", item!.PromoCode);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
        => Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"{Url}/999")).StatusCode);

    // ---------- Create ----------

    [Fact]
    public async Task Create_Returns201WithLabels()
    {
        var res = await _client.PostAsJsonAsync(Url, NewRequest());
        var created = await res.Content.ReadFromJsonAsync<FeaturedPromoItem>();

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        Assert.NotNull(res.Headers.Location);
        Assert.Equal("240614_MSAI", created!.PromoCode);
        Assert.Equal(new DateOnly(2026, 3, 17), created.ScheduleOn);
    }

    [Fact]
    public async Task Create_TakenSlot_Returns409WithMessage()
    {
        var req = NewRequest();
        req.ScheduleOn = new DateOnly(2026, 3, 16);
        var res = await _client.PostAsJsonAsync(Url, req);

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Contains("第 1 則", await MessageOf(res));
    }

    [Fact]
    public async Task Create_SameSlotOtherCenter_IsAllowed()
    {
        var req = NewRequest();
        req.ScheduleOn = new DateOnly(2026, 3, 16);
        req.TrainingCenterPkid = 3;
        Assert.Equal(HttpStatusCode.Created, (await _client.PostAsJsonAsync(Url, req)).StatusCode);
    }

    [Fact]
    public async Task Create_UnknownPromotion_Returns400()
    {
        var req = NewRequest();
        req.PromotionPkid = 999;
        var res = await _client.PostAsJsonAsync(Url, req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("999", await MessageOf(res));
    }

    [Fact]
    public async Task Create_UnknownTrainingCenter_Returns400()
    {
        var req = NewRequest();
        req.TrainingCenterPkid = 4;
        var res = await _client.PostAsJsonAsync(Url, req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("訓練中心", await MessageOf(res));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(4)]
    public async Task Create_SlotOutOfRange_Returns400(byte slot)
        => Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync(Url, NewRequest(slot: slot))).StatusCode);

    [Fact]
    public async Task Create_MissingScheduleOnOrTopic_Returns400()
    {
        var noDate = await _client.PostAsJsonAsync(Url, new
        {
            trainingCenterPkid = 1, slot = 1, promotionPkid = 104, topic = "t", description = "d",
        });
        var noTopic = NewRequest();
        noTopic.Topic = "";

        Assert.Equal(HttpStatusCode.BadRequest, noDate.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync(Url, noTopic)).StatusCode);
    }

    [Fact]
    public async Task Create_TooLongDescription_Returns400()
    {
        var req = NewRequest();
        req.Description = new string('x', 301);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync(Url, req)).StatusCode);
    }

    // ---------- Update ----------

    [Fact]
    public async Task Update_ChangesPromotionAndTexts()
    {
        var req = NewRequest(pkid: 2, slot: 2);
        req.ScheduleOn = new DateOnly(2026, 3, 16);
        var res = await _client.PutAsJsonAsync(Url, req);
        var updated = await res.Content.ReadFromJsonAsync<FeaturedPromoItem>();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("240614_MSAI", updated!.PromoCode);
        Assert.Equal("教你把AI變成實戰力", updated.Topic);
        Assert.Equal(2, updated.Slot);
    }

    [Fact]
    public async Task Update_IntoAnotherItemsSlot_Returns409()
    {
        var req = NewRequest(pkid: 2, slot: 1);
        req.ScheduleOn = new DateOnly(2026, 3, 16);
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PutAsJsonAsync(Url, req)).StatusCode);
    }

    [Fact]
    public async Task Update_NotFound_Returns404()
        => Assert.Equal(HttpStatusCode.NotFound, (await _client.PutAsJsonAsync(Url, NewRequest(pkid: 999))).StatusCode);

    [Fact]
    public async Task Update_MissingPkid_Returns400()
        => Assert.Equal(HttpStatusCode.BadRequest, (await _client.PutAsJsonAsync(Url, NewRequest(pkid: 0))).StatusCode);

    // ---------- Delete ----------

    [Fact]
    public async Task Delete_Returns204_ThenNotFound()
    {
        Assert.Equal(HttpStatusCode.NoContent, (await _client.DeleteAsync($"{Url}/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"{Url}/1")).StatusCode);
    }

    [Fact]
    public async Task Delete_NotFound_Returns404()
        => Assert.Equal(HttpStatusCode.NotFound, (await _client.DeleteAsync($"{Url}/999")).StatusCode);

    // ---------- Move (+ / −) ----------

    private async Task<Dictionary<int, int>> SlotsOnMonday()
        => (await QueryAsync(new { trainingCenterPkid = 1, weekOf = "2026-03-16" }))
            .Where(r => r.ScheduleOn == new DateOnly(2026, 3, 16))
            .ToDictionary(r => r.Pkid, r => (int)r.Slot);

    [Fact]
    public async Task MoveDown_SwapsWithNextSlot()
    {
        var res = await _client.PostAsync($"{Url}/1/move-down", null);

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        var slots = await SlotsOnMonday();
        Assert.Equal(2, slots[1]);
        Assert.Equal(1, slots[2]);
        Assert.Equal(3, slots[3]);
    }

    [Fact]
    public async Task MoveUp_SwapsWithPreviousSlot()
    {
        Assert.Equal(HttpStatusCode.NoContent, (await _client.PostAsync($"{Url}/3/move-up", null)).StatusCode);

        var slots = await SlotsOnMonday();
        Assert.Equal(2, slots[3]);
        Assert.Equal(3, slots[2]);
    }

    [Fact]
    public async Task MoveDown_IntoEmptySlot_JustMoves()
    {
        // Sunday 3/22 has only slot 1 (pkid 4).
        Assert.Equal(HttpStatusCode.NoContent, (await _client.PostAsync($"{Url}/4/move-down", null)).StatusCode);
        Assert.Equal(2, (await _client.GetFromJsonAsync<FeaturedPromoItem>($"{Url}/4"))!.Slot);
    }

    [Fact]
    public async Task MoveUp_FromFirstSlot_Returns400()
    {
        var res = await _client.PostAsync($"{Url}/1/move-up", null);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("第一則", await MessageOf(res));
    }

    [Fact]
    public async Task MoveDown_FromLastSlot_Returns400()
    {
        var res = await _client.PostAsync($"{Url}/3/move-down", null);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("最後一則", await MessageOf(res));
    }

    [Fact]
    public async Task Move_NotFound_Returns404()
        => Assert.Equal(HttpStatusCode.NotFound, (await _client.PostAsync($"{Url}/999/move-down", null)).StatusCode);

    // ---------- Lookups ----------

    [Fact]
    public async Task LookupTrainingCenters_InDisplayOrder()
    {
        var rows = await _client.GetFromJsonAsync<List<TrainingCenterLookup>>("/api/lookups/training-centers");
        Assert.Equal(["台北", "新竹", "台中", "高雄", "線上研討會"], rows!.Select(r => r.Name));
    }

    [Fact]
    public async Task LookupPromotions_ByPromoCodeKeyword_ReturnsTopicAndDescription()
    {
        var rows = await _client.GetFromJsonAsync<List<PromotionLookup>>("/api/lookups/promotions?keyword=googleai");

        var p = Assert.Single(rows!);
        Assert.Equal(102, p.Pkid);
        Assert.Equal("251211_GoogleAI", p.PromoCode);
        Assert.Equal("Google AI工具一次掌握", p.Topic);
        Assert.Equal("不需技術基礎", p.Description);
    }

    [Fact]
    public async Task LookupPromotions_ExactMatchFirst()
    {
        var rows = await _client.GetFromJsonAsync<List<PromotionLookup>>("/api/lookups/promotions?keyword=20251215_n8n");
        Assert.Equal("20251215_n8n", rows![0].PromoCode);
    }

    [Fact]
    public async Task LookupPromotions_BlankKeyword_ReturnsNewestFirst()
    {
        var rows = await _client.GetFromJsonAsync<List<PromotionLookup>>("/api/lookups/promotions");
        Assert.Equal([104, 103, 102, 101], rows!.Select(r => r.Pkid));
    }

    [Fact]
    public async Task LookupPromotions_NoMatch_ReturnsEmpty()
        => Assert.Empty((await _client.GetFromJsonAsync<List<PromotionLookup>>("/api/lookups/promotions?keyword=zzz"))!);

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
    }
}
