import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '@env/environment';
import { AUTH_PROFILE_KEY, AuthService, decodeClaims } from './auth.service';

/** Unsigned JWT with the given payload (the frontend never checks signatures). */
function fakeJwt(payload: object): string {
  const enc = (o: object) =>
    btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.sig`;
}

const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;

describe('AuthService', () => {
  let http: HttpTestingController;

  function setup(): AuthService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  function store(token: string): void {
    sessionStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify({ userId: 'alice', userName: 'Alice', accessToken: token }));
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => {
    http?.verify();
    sessionStorage.clear();
  });

  it('changePassword POSTs the three passwords to /auth/change-password', () => {
    const auth = setup();
    let done = false;
    const body = { currentPassword: 'P@ssw0rd!', newPassword: 'N3wPassword', confirmPassword: 'N3wPassword' };

    auth.changePassword(body).subscribe(() => (done = true));
    const req = http.expectOne(`${environment.apiUrl}/auth/change-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBeTrue();
  });

  it('getProfile GETs /auth/profile', () => {
    const auth = setup();
    let result: unknown;

    auth.getProfile().subscribe((p) => (result = p));
    const req = http.expectOne(`${environment.apiUrl}/auth/profile`);
    expect(req.request.method).toBe('GET');
    req.flush({ userId: 'alice', userName: 'Alice', roles: [] });

    expect(result).toEqual({ userId: 'alice', userName: 'Alice', roles: [] });
  });

  it('updateProfile PUTs { userName } and refreshes userName in memory and sessionStorage, keeping the token', () => {
    const token = fakeJwt({ role: ['User'], exp: inOneHour() });
    store(token);
    const auth = setup();

    auth.updateProfile({ userName: 'Alice Wang' }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/auth/profile`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ userName: 'Alice Wang' });
    req.flush({ userId: 'alice', userName: 'Alice Wang', roles: [] });

    expect(auth.userName()).toBe('Alice Wang');
    expect(JSON.parse(sessionStorage.getItem(AUTH_PROFILE_KEY)!)).toEqual({
      userId: 'alice',
      userName: 'Alice Wang',
      accessToken: token,
    });
  });

  it('updateProfile leaves the session untouched when the request fails', () => {
    store(fakeJwt({ exp: inOneHour() }));
    const auth = setup();

    auth.updateProfile({ userName: 'Alice Wang' }).subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/auth/profile`).flush({ message: 'x' }, { status: 400, statusText: 'Bad Request' });

    expect(auth.userName()).toBe('Alice');
    expect(JSON.parse(sessionStorage.getItem(AUTH_PROFILE_KEY)!).userName).toBe('Alice');
  });

  it('login posts { userId, password } and stores the profile in sessionStorage, not localStorage', () => {
    const auth = setup();
    const token = fakeJwt({ role: ['Admin', 'User'], exp: inOneHour() });

    auth.login({ userId: 'alice', password: 'pw' }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'alice', password: 'pw' });
    req.flush({ userId: 'alice', userName: 'Alice', accessToken: token });

    expect(JSON.parse(sessionStorage.getItem(AUTH_PROFILE_KEY)!)).toEqual({
      userId: 'alice',
      userName: 'Alice',
      accessToken: token,
    });
    expect(localStorage.length).toBe(0);
    expect(auth.profile()?.userName).toBe('Alice');
    expect(auth.token()).toBe(token);
    expect(auth.isLoggedIn()).toBeTrue();
  });

  it('a failed login stores nothing', () => {
    const auth = setup();

    auth.login({ userId: 'alice', password: 'bad' }).subscribe({ error: () => {} });
    http
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ message: '帳號或密碼錯誤' }, { status: 401, statusText: 'Unauthorized' });

    expect(sessionStorage.getItem(AUTH_PROFILE_KEY)).toBeNull();
    expect(auth.profile()).toBeNull();
  });

  it('restores the profile from sessionStorage and reads roles from the token', () => {
    store(fakeJwt({ role: ['Admin', 'User'], exp: inOneHour() }));
    const auth = setup();

    expect(auth.userName()).toBe('Alice');
    expect(auth.roles()).toEqual(['Admin', 'User']);
    expect(auth.isAdmin()).toBeTrue();
  });

  it('accepts a single role claim as a string, and no role claim at all', () => {
    store(fakeJwt({ role: 'User' }));
    expect(setup().roles()).toEqual(['User']);

    TestBed.resetTestingModule();
    store(fakeJwt({}));
    const auth = setup();
    expect(auth.roles()).toEqual([]);
    expect(auth.isAdmin()).toBeFalse();
  });

  it('is not admin when the roles do not include Admin', () => {
    store(fakeJwt({ role: ['User', 'Administrator'] }));
    expect(setup().isAdmin()).toBeFalse();
  });

  it('isLoggedIn is false without a token, with an unreadable token, or once the token expired', () => {
    expect(setup().isLoggedIn()).toBeFalse();

    store('garbage');
    expect(TestBed.inject(AuthService).isLoggedIn()).toBeFalse();

    store(fakeJwt({ exp: Math.floor(Date.now() / 1000) - 10 }));
    expect(TestBed.inject(AuthService).isLoggedIn()).toBeFalse();
  });

  it('logout clears sessionStorage and navigates to /login', () => {
    store(fakeJwt({ role: 'Admin' }));
    sessionStorage.setItem('course-list-filters', '{}');
    const auth = setup();
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    auth.logout();

    expect(sessionStorage.length).toBe(0);
    expect(auth.profile()).toBeNull();
    expect(auth.isAdmin()).toBeFalse();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('decodeClaims reads UTF-8 payloads and rejects junk', () => {
    const utf8 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ name: '王小明' }))))
      .replace(/=+$/, '');
    expect((decodeClaims(`x.${utf8}.y`) as { name?: string }).name).toBe('王小明');
    expect(decodeClaims(null)).toBeNull();
    expect(decodeClaims('no-dots')).toBeNull();
    expect(decodeClaims('a.!!!.b')).toBeNull();
  });
});
