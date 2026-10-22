import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { environment } from '@env/environment';
import { SERVER_ERROR_MESSAGE } from '../utils/server-error';
import { authInterceptor } from './auth.interceptor';
import { AUTH_PROFILE_KEY, AuthService } from './auth.service';

describe('authInterceptor', () => {
  const api = `${environment.apiUrl}/courses`;
  const token = 'header.payload.signature';
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;
  let messages: MessageService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => {
    backend.verify();
    sessionStorage.clear();
  });

  function signIn(): void {
    sessionStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify({ userId: 'alice', userName: 'Alice', accessToken: token }));
  }

  it('attaches Authorization: Bearer <token> from sessionStorage to API requests', () => {
    signIn();

    http.get(api).subscribe();

    const req = backend.expectOne(api);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush([]);
  });

  it('reads the token at request time, so a later login is picked up', () => {
    http.get(api).subscribe();
    expect(backend.expectOne(api).request.headers.has('Authorization')).toBeFalse();

    signIn();
    http.get(api).subscribe();
    expect(backend.expectOne(api).request.headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('does not send the token to other hosts', () => {
    signIn();

    http.get('https://example.com/data').subscribe();

    expect(backend.expectOne('https://example.com/data').request.headers.has('Authorization')).toBeFalse();
  });

  it('on 401 clears sessionStorage and redirects to /login with the current url', () => {
    signIn();
    sessionStorage.setItem('course-list-filters', '{}');
    spyOnProperty(router, 'url').and.returnValue('/courses/5');
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    let status = 0;

    http.get(api).subscribe({ error: (e) => (status = e.status) });
    backend.expectOne(api).flush({ message: '請先登入' }, { status: 401, statusText: 'Unauthorized' });

    expect(sessionStorage.length).toBe(0);
    expect(TestBed.inject(AuthService).profile()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/courses/5' } });
    expect(status).toBe(401); // the caller still sees the error
  });

  it('on 401 shows no toast (the login page takes over)', () => {
    signIn();
    spyOn(router, 'navigate').and.resolveTo(true);
    const add = spyOn(messages, 'add');

    http.get(api).subscribe({ error: () => {} });
    backend.expectOne(api).flush({ message: '請先登入' }, { status: 401, statusText: 'Unauthorized' });

    expect(add).not.toHaveBeenCalled();
  });

  // Added by /ship test coverage audit.
  // Value: protects=a 401 while already on /login redirects to /login without a returnUrl; fails_when=the startsWith('/login') check is dropped and returnUrl nests /login; why_new=existing 401 test only covers an app url; seam=none; no_claim=login page rendering
  it('on 401 while already on /login redirects without a returnUrl (no /login loop)', () => {
    signIn();
    spyOnProperty(router, 'url').and.returnValue('/login?returnUrl=%2Fcourses');
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);

    http.get(api).subscribe({ error: () => {} });
    backend.expectOne(api).flush({ message: '請先登入' }, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).toHaveBeenCalledOnceWith(['/login'], { queryParams: {} });
    expect(sessionStorage.length).toBe(0);
  });

  it('leaves the session alone on a failed login (401 from the login endpoint) and on other errors', () => {
    signIn();
    const navigate = spyOn(router, 'navigate');

    http.post(`${environment.apiUrl}/auth/login`, {}).subscribe({ error: () => {} });
    backend
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ message: '帳號或密碼錯誤' }, { status: 401, statusText: 'Unauthorized' });
    http.get(api).subscribe({ error: () => {} });
    backend.expectOne(api).flush({ message: 'x' }, { status: 409, statusText: 'Conflict' });

    expect(sessionStorage.getItem(AUTH_PROFILE_KEY)).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  describe('5xx', () => {
    it('toasts the safe message from the response body and still passes the error on', () => {
      signIn();
      const add = spyOn(messages, 'add');
      const navigate = spyOn(router, 'navigate');
      let status = 0;

      http.get(api).subscribe({ error: (e) => (status = e.status) });
      backend
        .expectOne(api)
        .flush({ message: '系統發生未預期的錯誤，請稍後再試' }, { status: 500, statusText: 'Internal Server Error' });

      expect(add).toHaveBeenCalledOnceWith({
        severity: 'error',
        summary: '系統錯誤',
        detail: '系統發生未預期的錯誤，請稍後再試',
      });
      expect(status).toBe(500);
      expect(navigate).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(AUTH_PROFILE_KEY)).not.toBeNull(); // still signed in
    });

    it('falls back to the generic message when a 5xx has no { message } (e.g. a gateway error page)', () => {
      const add = spyOn(messages, 'add');

      http.get(api).subscribe({ error: () => {} });
      backend.expectOne(api).flush('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' });
      http.get(api).subscribe({ error: () => {} });
      backend.expectOne(api).flush(null, { status: 503, statusText: 'Service Unavailable' });

      expect(add.calls.allArgs()).toEqual([
        [{ severity: 'error', summary: '系統錯誤', detail: SERVER_ERROR_MESSAGE }],
        [{ severity: 'error', summary: '系統錯誤', detail: SERVER_ERROR_MESSAGE }],
      ]);
    });

    it('also toasts a 5xx from the login endpoint', () => {
      const add = spyOn(messages, 'add');

      http.post(`${environment.apiUrl}/auth/login`, {}).subscribe({ error: () => {} });
      backend
        .expectOne(`${environment.apiUrl}/auth/login`)
        .flush({ message: 'x' }, { status: 500, statusText: 'Internal Server Error' });

      expect(add).toHaveBeenCalledOnceWith(jasmine.objectContaining({ detail: 'x' }));
    });

    it('leaves 400 / 403 / 404 / 409 to the caller and ignores other hosts', () => {
      signIn();
      const add = spyOn(messages, 'add');

      for (const status of [400, 403, 404, 409]) {
        http.get(api).subscribe({ error: () => {} });
        backend.expectOne(api).flush({ message: 'x' }, { status, statusText: 'x' });
      }
      http.get('https://example.com/data').subscribe({ error: () => {} });
      backend.expectOne('https://example.com/data').flush(null, { status: 500, statusText: 'x' });

      expect(add).not.toHaveBeenCalled();
    });
  });
});
