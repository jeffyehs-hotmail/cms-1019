import { HttpErrorResponse } from '@angular/common/http';
import { SERVER_ERROR_MESSAGE, isServerError, serverErrorMessage } from './server-error';

describe('server-error', () => {
  const res = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

  it('isServerError is true only for HTTP 500-599', () => {
    expect([500, 502, 503, 599].map((s) => isServerError(res(s)))).toEqual([true, true, true, true]);
    expect([0, 400, 401, 403, 404, 409, 600].map((s) => isServerError(res(s)))).toEqual(
      [false, false, false, false, false, false, false],
    );
    expect(isServerError(new Error('boom'))).toBeFalse();
    expect(isServerError(undefined)).toBeFalse();
  });

  it('serverErrorMessage uses the body { message }, else the generic fallback', () => {
    expect(serverErrorMessage(res(500, { message: '伺服器忙碌' }))).toBe('伺服器忙碌');
    expect(serverErrorMessage(res(500, { message: '  ' }))).toBe(SERVER_ERROR_MESSAGE);
    expect(serverErrorMessage(res(500, { message: 42 }))).toBe(SERVER_ERROR_MESSAGE);
    expect(serverErrorMessage(res(502, '<html>Bad Gateway</html>'))).toBe(SERVER_ERROR_MESSAGE);
    expect(serverErrorMessage(res(503))).toBe(SERVER_ERROR_MESSAGE);
  });

  it('the fallback matches the API generic 500 message (UnhandledExceptionMiddleware.Message)', () => {
    expect(SERVER_ERROR_MESSAGE).toBe('系統發生未預期的錯誤，請稍後再試');
  });
});
