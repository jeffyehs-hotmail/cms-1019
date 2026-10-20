import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { environment } from '@env/environment';
import { App } from './app';
import { AUTH_PROFILE_KEY, AuthService } from './core/auth/auth.service';

function fakeJwt(payload: object): string {
  const enc = (o: object) =>
    btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${enc({ alg: 'HS256' })}.${enc(payload)}.sig`;
}

/** Stores a signed-in profile; must run before the AuthService is created. */
function signIn(roles: string[] | undefined, userName = 'Alice'): void {
  const payload = roles ? { role: roles } : {};
  sessionStorage.setItem(
    AUTH_PROFILE_KEY,
    JSON.stringify({ userId: 'alice', userName, accessToken: fakeJwt(payload) }),
  );
}

describe('App', () => {
  afterEach(() => sessionStorage.clear());

  beforeEach(async () => {
    sessionStorage.clear();
    signIn(['Admin', 'User']);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the 系統管理 Admin > 使用者 AppUser / 角色 AppRole sidebar entries', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.nav-group')?.textContent).toContain('系統管理 Admin');
    const links = el.querySelectorAll('.nav-items a') as NodeListOf<HTMLAnchorElement>;
    expect(links[0].textContent).toContain('使用者 AppUser');
    expect(links[0].getAttribute('href')).toBe('/app-users');
    expect(links[1].textContent).toContain('角色 AppRole');
    expect(links[1].getAttribute('href')).toBe('/app-roles');
  });

  it('collapses a nav group when its header is clicked', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('.nav-items').length).toBe(3);
    (el.querySelector('.nav-group') as HTMLButtonElement).click();
    fixture.detectChanges();

    // Only the clicked group (系統管理 Admin) collapses; 首頁 Home and 課程管理 Course stay open.
    const remaining = el.querySelectorAll('.nav-items');
    expect(remaining.length).toBe(2);
    expect(remaining[0].textContent).toContain('上稿作業 FeaturedPromoItem');
    expect(remaining[1].textContent).toContain('原廠 Partner');
  });

  it('renders the 系統管理 Admin > Token 用量 AgentTokenUsage sidebar entry last in the Admin group', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const adminLinks = el.querySelectorAll('.nav-items')[0].querySelectorAll('a');
    const last = adminLinks[adminLinks.length - 1] as HTMLAnchorElement;
    expect(last.textContent).toContain('Token 用量 AgentTokenUsage');
    expect(last.getAttribute('href')).toBe('/agent-token-usages');
  });

  it('renders the 首頁 Home > 上稿作業 FeaturedPromoItem sidebar entry', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const link = el.querySelector('a[href="/featured-promo-items"]') as HTMLAnchorElement;
    expect(link.textContent).toContain('上稿作業 FeaturedPromoItem');
    expect(el.querySelectorAll('.nav-group')[1].textContent).toContain('首頁 Home');
  });

  it('shows the signed-in UserName and a 登出 button in the header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.topbar .user-name')?.textContent).toContain('Alice');
    expect(el.querySelector('.topbar')?.textContent).toContain('登出');
  });

  it('links the header UserName to the 我的個人資料 page', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector('.topbar a.user-name') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/profile');
    expect(link.title).toContain('我的個人資料');
  });

  it('refreshes the header UserName after the profile is saved', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    TestBed.inject(AuthService).updateProfile({ userName: 'Alice Wang' }).subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne(`${environment.apiUrl}/auth/profile`)
      .flush({ userId: 'alice', userName: 'Alice Wang', roles: [] });
    fixture.detectChanges();

    expect(el.querySelector('.topbar .user-name')?.textContent).toContain('Alice Wang');
  });

  it('登出 clears sessionStorage and returns to the login page', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('.topbar button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(sessionStorage.length).toBe(0);
    expect(navigate).toHaveBeenCalledWith('/login');
    expect(el.querySelector('.sidebar')).toBeNull();
  });

  describe('for non-Admin users', () => {
    for (const [label, roles] of [
      ['roles without Admin', ['User']],
      ['no role claims', undefined],
    ] as const) {
      it(`hides the 系統管理 Admin menu item (${label})`, () => {
        sessionStorage.clear();
        signIn(roles ? [...roles] : undefined, 'Bob');
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;

        const groups = Array.from(el.querySelectorAll('.nav-group')).map((g) => g.textContent ?? '');
        expect(groups.length).toBe(2);
        expect(groups.some((g) => g.includes('系統管理 Admin'))).toBeFalse();
        expect(el.querySelector('a[href="/app-users"]')).toBeNull();
        expect(el.querySelector('a[href="/featured-promo-items"]')).not.toBeNull();
        expect(el.querySelector('.topbar .user-name')?.textContent).toContain('Bob');
      });
    }
  });

  it('shows the 系統管理 Admin menu item when the roles include Admin', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('.nav-group').length).toBe(3);
    expect(el.querySelector('.nav-group')?.textContent).toContain('系統管理 Admin');
  });

  it('renders no shell (sidebar / header) when signed out', () => {
    TestBed.inject(AuthService).clearSession();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.sidebar')).toBeNull();
    expect(el.querySelector('.topbar')).toBeNull();
  });
});
