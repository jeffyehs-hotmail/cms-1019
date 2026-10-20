import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { authGuard, loginGuard } from './auth.guard';
import { AUTH_PROFILE_KEY } from './auth.service';

@Component({ template: 'login page' })
class LoginStub {}

@Component({ template: 'courses page' })
class CoursesStub {}

function fakeJwt(payload: object): string {
  const enc = (o: object) =>
    btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${enc({ alg: 'HS256' })}.${enc(payload)}.sig`;
}

describe('auth guards', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([
          { path: 'login', canActivate: [loginGuard], component: LoginStub },
          {
            path: '',
            canActivateChild: [authGuard],
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'courses' },
              { path: 'courses', component: CoursesStub },
            ],
          },
        ]),
      ],
    });
  });

  afterEach(() => sessionStorage.clear());

  function signIn(exp = Math.floor(Date.now() / 1000) + 3600): void {
    sessionStorage.setItem(
      AUTH_PROFILE_KEY,
      JSON.stringify({ userId: 'alice', userName: 'Alice', accessToken: fakeJwt({ exp }) }),
    );
  }

  it('redirects app routes to /login?returnUrl=… when there is no token', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/courses?x=1');

    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fcourses%3Fx%3D1');
    expect(harness.routeNativeElement?.textContent).toContain('login page');
  });

  it('redirects and clears the stale session when the token has expired', async () => {
    signIn(Math.floor(Date.now() / 1000) - 60);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/courses');

    expect(TestBed.inject(Router).url).toContain('/login');
    expect(sessionStorage.getItem(AUTH_PROFILE_KEY)).toBeNull();
  });

  it('lets app routes through with a token', async () => {
    signIn();
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/courses');

    expect(TestBed.inject(Router).url).toBe('/courses');
    expect(harness.routeNativeElement?.textContent).toContain('courses page');
  });

  it('keeps the login page public', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/login');

    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.textContent).toContain('login page');
  });

  it('sends a signed-in user from /login to home', async () => {
    signIn();
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/login');

    expect(TestBed.inject(Router).url).toBe('/courses');
  });
});
