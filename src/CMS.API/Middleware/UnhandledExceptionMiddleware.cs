namespace CMS.API.Middleware;

/// <summary>
/// Last line of defence for exceptions no controller or repository handled (SQL errors, bugs, …): logs the full
/// exception server-side and answers 500 <c>{ message }</c> with a generic text, so stack traces, SQL and
/// connection details never reach the client. Responses the app writes itself (401/403/400/409, the explicit
/// SysConfig 500s) don't throw and pass through unchanged.
/// </summary>
public sealed class UnhandledExceptionMiddleware(RequestDelegate next, ILogger<UnhandledExceptionMiddleware> logger)
{
    public const string Message = "系統發生未預期的錯誤，請稍後再試";

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client went away; there is nobody to answer and nothing went wrong on our side.
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception on {Method} {Path}", context.Request.Method, context.Request.Path);

            // Headers and part of the body are already sent: the status can't change any more, let the server abort.
            if (context.Response.HasStarted) throw;

            // Clear() drops headers set so far; CORS headers survive because CorsMiddleware adds them on OnStarting.
            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(new { message = Message });
        }
    }
}
