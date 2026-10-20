using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using CMS.API.Models;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace CMS.API.Tests;

public class AuthControllerTests : IDisposable
{
    private const string Url = "/api/auth/login";
    private static readonly DateTimeOffset Now = new(2026, 10, 20, 8, 30, 0, TimeSpan.Zero);

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public AuthControllerTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    private static async Task<string?> MessageOf(HttpResponseMessage res)
        => (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString();

    private Task<HttpResponseMessage> Login(string userId, string password, HttpClient? client = null)
        => (client ?? _client).PostAsJsonAsync(Url, new { userId, password });

    private async Task<string> TokenFor(string userId, HttpClient? client = null)
        => (await (await Login(userId, FakeAuthRepository.Password, client)).Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken;

    private HttpClient ClientAt(DateTimeOffset now)
        => _factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<TimeProvider>();
            s.AddSingleton<TimeProvider>(new FixedTimeProvider(now));
        })).CreateClient();

    /// <summary>Validates the signature against <paramref name="key"/> and the lifetime at <paramref name="at"/>.</summary>
    private static async Task<TokenValidationResult> ValidateAsync(string token, DateTimeOffset at, string key = FakeAuthRepository.SigningKey)
        => await new JsonWebTokenHandler().ValidateTokenAsync(token, new TokenValidationParameters
        {
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            ValidateIssuer = false,
            ValidateAudience = false,
            LifetimeValidator = (nbf, exp, _, _) => nbf <= at.UtcDateTime && at.UtcDateTime < exp,
        });

    // ---------- Success ----------

    [Fact]
    public async Task Login_ValidActiveUser_ReturnsProfileAndToken()
    {
        var res = await Login("alice", FakeAuthRepository.Password);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.Equal("alice", body!.UserId);
        Assert.Equal("Alice", body.UserName);
        Assert.False(string.IsNullOrEmpty(body.AccessToken));
    }

    [Fact]
    public async Task Login_Token_IsSignedWithSysConfigKey_AndCarriesUserAndRoleClaims()
    {
        var result = await ValidateAsync(await TokenFor("alice"), DateTimeOffset.UtcNow);

        Assert.True(result.IsValid, result.Exception?.Message);
        var jwt = (JsonWebToken)result.SecurityToken;
        Assert.Equal("HS256", jwt.Alg);
        Assert.Equal("alice", jwt.Subject);
        Assert.Equal("Alice", jwt.GetClaim("name").Value);
        Assert.Equal(["Admin", "User"], jwt.Claims.Where(c => c.Type == "role").Select(c => c.Value).Order());
    }

    [Fact]
    public async Task Login_UserWithoutRoles_HasNoRoleClaims()
    {
        var jwt = new JsonWebToken(await TokenFor("carol"));

        Assert.DoesNotContain(jwt.Claims, c => c.Type == "role");
    }

    [Fact]
    public async Task Login_Token_Expires24HoursAfterIssue()
    {
        var token = await TokenFor("alice", ClientAt(Now));
        var jwt = new JsonWebToken(token);

        Assert.Equal(Now.UtcDateTime, jwt.IssuedAt);
        Assert.Equal(Now.UtcDateTime.AddHours(24), jwt.ValidTo);
        Assert.True((await ValidateAsync(token, Now.AddHours(24).AddSeconds(-1))).IsValid);
        Assert.False((await ValidateAsync(token, Now.AddHours(24))).IsValid);
    }

    [Fact]
    public async Task Login_Response_NeverContainsPasswordHash()
    {
        var res = await Login("alice", FakeAuthRepository.Password);
        var json = await res.Content.ReadAsStringAsync();
        var hash = _factory.Auth.Find("alice").PasswordHash;

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.DoesNotContain("password", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(hash, json, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(["accessToken", "userId", "userName"],
            JsonDocument.Parse(json).RootElement.EnumerateObject().Select(p => p.Name).Order());

        // Nor inside the token payload.
        var jwt = new JsonWebToken(JsonDocument.Parse(json).RootElement.GetProperty("accessToken").GetString()!);
        var payload = Encoding.UTF8.GetString(Base64UrlEncoder.DecodeBytes(jwt.EncodedPayload));
        Assert.DoesNotContain(hash, payload, StringComparison.OrdinalIgnoreCase);
    }

    // ---------- Failures: 401 with one generic message ----------

    [Theory]
    [InlineData("alice", "wrong-password")]              // wrong password
    [InlineData("alice", "p@ssw0rd!")]                   // password is case-sensitive
    [InlineData("nobody", FakeAuthRepository.Password)]  // unknown UserId
    [InlineData("bob", FakeAuthRepository.Password)]     // IsActive = 0
    [InlineData("ALICE", FakeAuthRepository.Password)]   // UserId must match exactly (DB collation is case-insensitive)
    [InlineData("alice ", FakeAuthRepository.Password)]  // SQL '=' ignores trailing spaces; login must not
    public async Task Login_InvalidCredentials_Returns401WithGenericMessage(string userId, string password)
    {
        var res = await Login(userId, password);

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Equal("帳號或密碼錯誤", await MessageOf(res));
        Assert.DoesNotContain("accessToken", await res.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Login_FailureReasons_AreIndistinguishable()
    {
        var bodies = new[]
        {
            await (await Login("alice", "wrong")).Content.ReadAsStringAsync(),
            await (await Login("nobody", FakeAuthRepository.Password)).Content.ReadAsStringAsync(),
            await (await Login("bob", FakeAuthRepository.Password)).Content.ReadAsStringAsync(),
        };

        Assert.Single(bodies.Distinct());
    }

    [Theory]
    [InlineData("", "x")]
    [InlineData("alice", "")]
    public async Task Login_MissingFields_Returns400(string userId, string password)
        => Assert.Equal(HttpStatusCode.BadRequest, (await Login(userId, password)).StatusCode);

    // ---------- Signing key from SysConfig ----------

    [Theory]
    [InlineData(null)]                                          // appConfig row missing
    [InlineData("""{ "defaultPassword": "x" }""")]              // no symmetricSecurityKey
    [InlineData("""{ "symmetricSecurityKey": "too-short" }""")] // < 256 bits
    [InlineData("not json")]
    public async Task Login_NoUsableSigningKey_Returns500(string? appConfig)
    {
        _factory.Auth.AppConfigValue = appConfig;

        var res = await Login("alice", FakeAuthRepository.Password);

        Assert.Equal(HttpStatusCode.InternalServerError, res.StatusCode);
        Assert.Contains("symmetricSecurityKey", await MessageOf(res));
    }

    [Fact]
    public async Task Login_ReadsSigningKeyAtRuntime()
    {
        const string newKey = "another-runtime-key-abcdefghijklmnop";
        _factory.Auth.AppConfigValue = $$"""{ "symmetricSecurityKey": "{{newKey}}" }""";

        var token = await TokenFor("alice");

        Assert.True((await ValidateAsync(token, DateTimeOffset.UtcNow, newKey)).IsValid);
        Assert.False((await ValidateAsync(token, DateTimeOffset.UtcNow)).IsValid);
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
    }
}
