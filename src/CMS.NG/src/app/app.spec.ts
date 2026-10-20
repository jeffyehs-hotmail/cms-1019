import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideNoopAnimations(), MessageService, ConfirmationService],
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

  it('renders the 首頁 Home > 上稿作業 FeaturedPromoItem sidebar entry', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const link = el.querySelector('a[href="/featured-promo-items"]') as HTMLAnchorElement;
    expect(link.textContent).toContain('上稿作業 FeaturedPromoItem');
    expect(el.querySelectorAll('.nav-group')[1].textContent).toContain('首頁 Home');
  });
});
