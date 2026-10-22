using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json;
using CMS.API.Middleware;
using CMS.API.Repositories;
using CMS.API.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace CMS.API.Tests;

/// <summary>Unhandled exceptions become a generic 500 { message }; the app's own 400/401/403 responses are unchanged.</summary>
public class UnhandledExceptionTests : IDisposable
{
    // What a SQL failure could leak: statement text and connection details.
    private const string Secret = "Invalid column name 'Bogus'. SELECT Bogus FROM CourseGroup; Server=.\\SQLEXPRESS;Password=hunter2";

    private readonly CmsApiFactory _factory = new();
    private readonly LogCollector _logs = new();

    public void Dispose() => _factory.Dispose();

    /// <summary>A client whose ICourseGroupRepository throws <see cref="Secret"/> from every method.</summary>
    private HttpClient ThrowingClient()
        => _factory.WithWebHostBuilder(b => b
            .ConfigureLogging(l => l.AddProvider(_logs))
            .ConfigureTestServices(s =>
            {
                s.RemoveAll<ICourseGroupRepository>();
                s.AddSingleton(ThrowingProxy.Create<ICourseGroupRepository>(new InvalidOperationException(Secret)));
            })).CreateClient();

    [Theory]
    [InlineData("GET", "/api/course-groups")]
    [InlineData("GET", "/api/course-groups/1")]
    [InlineData("DELETE", "/api/course-groups/2")]
    public async Task ThrowingRepository_Returns500WithGenericMessageOnly(string method, string url)
    {
        var res = await ThrowingClient().SendAsync(new HttpRequestMessage(new HttpMethod(method), url));
        var body = await res.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.InternalServerError, res.StatusCode);
        Assert.StartsWith("application/json", res.Content.Headers.ContentType?.ToString());
        var json = JsonDocument.Parse(body).RootElement;
        Assert.Equal(UnhandledExceptionMiddleware.Message, json.GetProperty("message").GetString());
        Assert.Single(json.EnumerateObject());
        Assert.DoesNotContain("SELECT", body);
        Assert.DoesNotContain("SQLEXPRESS", body);
        Assert.DoesNotContain("hunter2", body);
        Assert.DoesNotContain("InvalidOperationException", body);
        Assert.DoesNotContain(" at ", body); // no stack frames
    }

    [Fact]
    public async Task ThrowingRepository_LogsFullExceptionServerSide()
    {
        await ThrowingClient().GetAsync("/api/course-groups");

        var entry = Assert.Single(_logs.Entries, e => e.Category == typeof(UnhandledExceptionMiddleware).FullName);
        Assert.Equal(LogLevel.Error, entry.Level);
        Assert.Contains("GET /api/course-groups", entry.Message);
        var ex = Assert.IsType<InvalidOperationException>(entry.Exception);
        Assert.Equal(Secret, ex.Message);
        Assert.NotNull(ex.StackTrace);
    }

    [Fact]
    public async Task ThrowingRepository_500KeepsCorsHeaders_SoTheBrowserCanReadTheMessage()
    {
        var req = new HttpRequestMessage(HttpMethod.Get, "/api/course-groups");
        req.Headers.Add("Origin", "http://localhost:4200");

        var res = await ThrowingClient().SendAsync(req);

        Assert.Equal(HttpStatusCode.InternalServerError, res.StatusCode);
        Assert.Equal("http://localhost:4200", res.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }

    [Fact]
    public async Task Unauthenticated_Still401WithItsMessage()
    {
        var client = ThrowingClient();
        client.DefaultRequestHeaders.Authorization = null;

        var res = await client.GetAsync("/api/course-groups");

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Equal(JwtAuthentication.Unauthenticated, await MessageOf(res));
        Assert.DoesNotContain(_logs.Entries, e => e.Category == typeof(UnhandledExceptionMiddleware).FullName);
    }

    [Fact]
    public async Task Forbidden_Still403WithItsMessage()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", CmsApiFactory.AccessToken("carol", "Carol", ["User"]));

        var res = await client.PostAsync("/api/app-users/1/reset-password", null);

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Equal(JwtAuthentication.Forbidden, await MessageOf(res));
    }

    [Fact]
    public async Task ModelValidation_Still400ProblemDetails()
    {
        var res = await ThrowingClient().PostAsJsonAsync("/api/course-groups", new { description = "" });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("application/problem+json", res.Content.Headers.ContentType?.MediaType);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("errors").TryGetProperty("Description", out _));
    }

    [Fact]
    public async Task BusinessRule_Still400WithItsMessage()
    {
        var res = await _factory.CreateClient().PutAsJsonAsync("/api/course-groups", new { pkid = 0, description = "x" });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("pkid is required", await MessageOf(res));
    }

    private static async Task<string?> MessageOf(HttpResponseMessage res)
        => (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString();

    /// <summary>Implements any interface by throwing the given exception from every method.</summary>
    public class ThrowingProxy : DispatchProxy
    {
        private Exception _exception = null!;

        public static T Create<T>(Exception exception) where T : class
        {
            var proxy = Create<T, ThrowingProxy>();
            ((ThrowingProxy)(object)proxy)._exception = exception;
            return proxy;
        }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) => throw _exception;
    }

    public sealed class LogCollector : ILoggerProvider
    {
        public record Entry(string Category, LogLevel Level, string Message, Exception? Exception);

        private readonly ConcurrentQueue<Entry> _entries = new();
        public IReadOnlyCollection<Entry> Entries => _entries;

        public ILogger CreateLogger(string categoryName) => new Logger(categoryName, _entries);
        public void Dispose() { }

        private sealed class Logger(string category, ConcurrentQueue<Entry> entries) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
                Func<TState, Exception?, string> formatter)
                => entries.Enqueue(new Entry(category, logLevel, formatter(state, exception), exception));
        }
    }
}
