using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CMS.API.Security;

namespace CMS.API.Tests;

/// <summary>POST api/auth/change-password: the signed-in user (UserId from the JWT) changes their own password.</summary>
public class ChangePasswordTests : IDisposable
{
    private const string Url = "/api/auth/change-password";
    private const string NewPassword = "N3wPassword";

    private readonly CmsApiFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private HttpClient ClientAs(string userId, string userName)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CmsApiFactory.AccessToken(userId, userName, []));
        return client;
    }

    private Task<HttpResponseMessage> Change(string current, string next, string? confirm = null, HttpClient? client = null)
        => (client ?? ClientAs("carol", "Carol")).PostAsJsonAsync(Url,
            new { currentPassword = current, newPassword = next, confirmPassword = confirm ?? next });

    private static async Task<string?> MessageOf(HttpResponseMessage res)
        => (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString();

    private static DateTime TaipeiNow() => DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(8)).DateTime;

    private void AssertUnchanged(string userId = "carol")
    {
        Assert.Equal(PasswordHasher.Hash(FakeAuthRepository.Password), _factory.Auth.Find(userId).PasswordHash);
        Assert.False(_factory.Auth.PasswordUpdatedTimes.ContainsKey(userId));
    }

    [Fact]
    public async Task ValidChange_StoresSha256OfNewPasswordAndUpdatesTime()
    {
        var before = TaipeiNow();
        var res = await Change(FakeAuthRepository.Password, NewPassword);
        var after = TaipeiNow();

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.Empty(await res.Content.ReadAsByteArrayAsync());
        Assert.Equal(PasswordHasher.Hash(NewPassword), _factory.Auth.Find("carol").PasswordHash);
        Assert.InRange(_factory.Auth.PasswordUpdatedTimes["carol"]!.Value, before, after); // Taipei time
        AssertUnchanged("alice");
    }

    [Fact]
    public async Task ValidChange_NewPasswordWorksForLogin()
    {
        await Change(FakeAuthRepository.Password, NewPassword);
        var anonymous = _factory.CreateClient();
        anonymous.DefaultRequestHeaders.Authorization = null;

        var oldLogin = await anonymous.PostAsJsonAsync("/api/auth/login", new { userId = "carol", password = FakeAuthRepository.Password });
        var newLogin = await anonymous.PostAsJsonAsync("/api/auth/login", new { userId = "carol", password = NewPassword });

        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);
        Assert.Equal(HttpStatusCode.OK, newLogin.StatusCode);
    }

    [Theory]
    [InlineData("wrong")]
    [InlineData("p@ssw0rd!")] // case matters
    [InlineData("P@ssw0rd! ")]
    public async Task WrongCurrentPassword_Returns400AndChangesNothing(string current)
    {
        var res = await Change(current, NewPassword);

        // 400, not 401: the frontend interceptor signs the user out on any 401.
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("目前密碼錯誤", await MessageOf(res));
        AssertUnchanged();
    }

    [Fact]
    public async Task MissingFields_Return400AndChangeNothing()
    {
        var res = await ClientAs("carol", "Carol").PostAsJsonAsync(Url, new { newPassword = NewPassword });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        AssertUnchanged();
    }

    [Theory]
    [InlineData("Ab1!xyz")]      // 7 chars, all 4 classes
    [InlineData("abcdefgh")]     // 1 class
    [InlineData("abcdefg1")]     // lower + digit
    [InlineData("ABCDEFG!")]     // upper + symbol
    [InlineData("abcdEFGH")]     // lower + upper
    [InlineData("12345678!@")]   // digit + symbol
    [InlineData("abcd EFGH")]    // a space is not a symbol
    [InlineData("密碼密碼abcDEF")] // CJK is not a symbol
    public async Task WeakNewPassword_Returns400WithPolicyMessageAndChangesNothing(string weak)
    {
        var res = await Change(FakeAuthRepository.Password, weak);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var message = await MessageOf(res);
        Assert.Equal(PasswordPolicy.Message, message);
        Assert.StartsWith("密碼長度至少需 8 碼，且內容須至少包含四種字元的其中三種：大寫英文／小寫英文／數字／符號", message);
        Assert.Contains("Password must be at least 8 characters", message);
        AssertUnchanged();
    }

    [Theory]
    [InlineData("Abcdefg1")]  // upper + lower + digit, exactly 8
    [InlineData("abcdefg1!")] // lower + digit + symbol
    [InlineData("ABCDEFG1-")] // upper + digit + symbol
    [InlineData("Abcdefg_")]  // upper + lower + symbol
    [InlineData("Ab1!Ab1!")]  // all 4
    public async Task ComplexNewPassword_IsAccepted(string strong)
    {
        var res = await Change(FakeAuthRepository.Password, strong);

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.Equal(PasswordHasher.Hash(strong), _factory.Auth.Find("carol").PasswordHash);
    }

    [Theory]
    [InlineData("N3wPassword2")]
    [InlineData("n3wpassword")] // case matters
    [InlineData("N3wPassword ")]
    public async Task ConfirmMismatch_Returns400AndChangesNothing(string confirm)
    {
        var res = await Change(FakeAuthRepository.Password, NewPassword, confirm);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("新密碼與確認新密碼不一致", await MessageOf(res));
        AssertUnchanged();
    }

    [Fact]
    public async Task ChangesOnlyTheJwtUser_IgnoringUserIdInBody()
    {
        var res = await ClientAs("carol", "Carol").PostAsJsonAsync(Url, new
        {
            userId = "alice",
            currentPassword = FakeAuthRepository.Password,
            newPassword = NewPassword,
            confirmPassword = NewPassword,
        });

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.Equal(PasswordHasher.Hash(NewPassword), _factory.Auth.Find("carol").PasswordHash);
        AssertUnchanged("alice");
    }

    [Fact]
    public async Task ResponsesNeverContainAPasswordHash()
    {
        var bad = await (await Change("wrong", "Another1!")).Content.ReadAsStringAsync();
        var ok = await (await Change(FakeAuthRepository.Password, NewPassword)).Content.ReadAsStringAsync();

        foreach (var body in new[] { ok, bad })
        {
            Assert.DoesNotContain(PasswordHasher.Hash(FakeAuthRepository.Password), body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(PasswordHasher.Hash(NewPassword), body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("hash", body, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task JwtUserNoLongerExists_Returns404()
    {
        var res = await Change(FakeAuthRepository.Password, NewPassword, client: ClientAs("ghost", "Ghost"));

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        Assert.Equal("找不到目前登入的使用者", await MessageOf(res));
    }

    [Fact]
    public async Task WithoutToken_Returns401AndChangesNothing()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = null;

        var res = await Change(FakeAuthRepository.Password, NewPassword, client: client);

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        AssertUnchanged("alice");
    }
}
