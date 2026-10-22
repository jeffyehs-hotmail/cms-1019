import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { isServerError, serverErrorMessage } from '../utils/server-error';
import { AuthService } from './auth.service';

/**
 * Sends `Authorization: Bearer <token>` (from sessionStorage) on every API request. A 401 from the API, other than
 * a failed login, means the token is missing/expired/rejected: clear the session and go to the login page.
 * A 5xx toasts the server's safe `{ message }` here, once for the whole app; components skip their own toast for
 * it (`isServerError`). Other statuses (400/403/404/409) are left to the caller.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const messages = inject(MessageService);
  const token = auth.token();
  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && req.url !== auth.loginUrl) {
        auth.clearSession();
        const returnUrl = router.url.startsWith('/login') ? undefined : router.url;
        router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : {} });
      } else if (err instanceof HttpErrorResponse && isServerError(err)) {
        messages.add({ severity: 'error', summary: '系統錯誤', detail: serverErrorMessage(err) });
      }
      return throwError(() => err);
    }),
  );
};
