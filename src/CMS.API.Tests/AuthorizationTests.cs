using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using CMS.API.Controllers;
using CMS.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace CMS.API.Tests;

/// <summary>Global JWT bearer authorization: every controller needs a login token except AuthController.</summary>
public class AuthorizationTests : IDisposable
{
    private const string Protected = "/api/app-roles";

    private readonly CmsApiFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private HttpClient ClientWith(string? token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = token is null ? null : new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static async Task<string?> MessageOf(HttpResponseMessage res)
        => (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString();

    // ---------- Protected endpoints ----------

    [Fact]
    public async Task ProtectedEndpoint_WithValidToken_Returns200()
    {
        var res = await ClientWith(CmsApiFactory.AccessToken()).GetAsync(Protected);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithTokenFromLogin_Returns200()
    {
        var anonymous = ClientWith(null);
        var login = await anonymous.PostAsJsonAsync("/api/auth/login", new { userId = "carol", password = FakeAuthRepository.Password });
        var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString();

        var res = await ClientWith(token).GetAsync(Protected);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutToken_Returns401WithMessage()
    {
        var res = await ClientWith(null).GetAsync(Protected);

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Equal("Bearer", res.Headers.WwwAuthenticate.Single().Scheme);
        Assert.Equal(JwtAuthentication.Unauthenticated, await MessageOf(res));
    }

    public static TheoryData<string> InvalidTokens()
    {
        var otherKey = Encoding.UTF8.GetBytes("another-signing-key-0123456789abcdef");
        var valid = CmsApiFactory.AccessToken();
        return new TheoryData<string>
        {
            "not-a-jwt",
            "eyJhbGciOiJIUzI1NiJ9.x.y",
            AccessTokenIssuer.Create("alice", "Alice", ["Admin"], otherKey, DateTime.UtcNow),          // wrong key
            CmsApiFactory.AccessToken(now: DateTime.UtcNow.AddHours(-25)),                           // expired
            valid[..^2] + (valid[^2] == 'A' ? "BB" : "AA"),                                         // tampered signature
            "cms_at_alice-test-token",                                                               // agent token
        };
    }

    [Theory]
    [MemberData(nameof(InvalidTokens))]
    public async Task ProtectedEndpoint_WithInvalidToken_Returns401(string token)
    {
        var res = await ClientWith(token).GetAsync(Protected);

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WhenSysConfigKeyMissing_Returns401()
    {
        _factory.Auth.AppConfigValue = """{ "defaultPassword": "x" }""";

        var res = await ClientWith(CmsApiFactory.AccessToken()).GetAsync(Protected);

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_ValidatesAgainstCurrentSysConfigKey()
    {
        var client = ClientWith(CmsApiFactory.AccessToken());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(Protected)).StatusCode);

        _factory.Auth.AppConfigValue = """{ "symmetricSecurityKey": "rotated-signing-key-0123456789abcdef" }""";

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(Protected)).StatusCode);
    }

    // ---------- Anonymous endpoints ----------

    [Theory]
    [InlineData(null)]
    [InlineData("not-a-jwt")]
    public async Task Login_StaysAnonymous_EvenWithMissingOrBadBearer(string? token)
    {
        var res = await ClientWith(token).PostAsJsonAsync("/api/auth/login", new { userId = "alice", password = FakeAuthRepository.Password });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Login_WrongPassword_KeepsItsOwn401Message()
    {
        var res = await ClientWith(null).PostAsJsonAsync("/api/auth/login", new { userId = "alice", password = "wrong" });

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Equal("帳號或密碼錯誤", await MessageOf(res));
    }

    [Fact]
    public void OnlyLoginAndAgentTokenIngest_AllowAnonymous_EveryOtherActionRequiresAuthorization()
    {
        var actions = _factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .Select(e => (Endpoint: e, Action: e.Metadata.GetMetadata<ControllerActionDescriptor>()))
            .Where(x => x.Action is not null)
            .ToList();
        Assert.NotEmpty(actions);

        var anonymous = actions.Where(x => x.Endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null)
            .Select(x => $"{x.Action!.ControllerName}.{x.Action.ActionName}").Order();
        Assert.Equal(["AgentTokenUsages.Report", "Auth.Login"], anonymous);
        Assert.All(actions, x => Assert.NotEmpty(x.Endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()));
        Assert.Contains(actions, x => x.Action!.ControllerTypeInfo == typeof(AppUsersController));
    }
}
