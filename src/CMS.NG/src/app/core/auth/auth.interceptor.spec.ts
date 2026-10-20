import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '@env/environment';
import { authInterceptor } from './auth.interceptor';
import { AUTH_PROFILE_KEY, AuthService } from './auth.service';

describe('authInterceptor', () => {
  const api = `${environment.apiUrl}/courses`;
  const token = 'header.payload.signature';
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
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
});
