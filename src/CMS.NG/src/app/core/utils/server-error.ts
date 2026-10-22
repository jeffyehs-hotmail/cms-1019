import { HttpErrorResponse } from '@angular/common/http';

/** Fallback when a 5xx carries no `{ message }` (e.g. a proxy error page); same text as the API's generic 500. */
export const SERVER_ERROR_MESSAGE = '系統發生未預期的錯誤，請稍後再試';

/**
 * A 5xx from the API. The `authInterceptor` already toasts these with the server's safe message, so a component's
 * `error:` callback skips its own toast for them (`if (!isServerError(err)) this.messages.add(…)`) to avoid two.
 * Deliberately not a type guard: `!isServerError(err)` would narrow an `HttpErrorResponse` param to `never`.
 */
export function isServerError(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status >= 500 && err.status <= 599;
}

/** The API's `{ message }` (e.g. a 403 or 409), or `fallback` when the error carries none. */
export function errorMessage(err: unknown, fallback: string): string {
  const message = err instanceof HttpErrorResponse ? (err.error as { message?: unknown } | null)?.message : undefined;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

/** The `{ message }` of a 5xx body, or the generic fallback. */
export function serverErrorMessage(err: HttpErrorResponse): string {
  const message = (err.error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.trim() ? message : SERVER_ERROR_MESSAGE;
}
