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

  it('renders the 系統管理 Admin > 角色 AppRole sidebar entry', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.nav-group')?.textContent).toContain('系統管理 Admin');
    const link = el.querySelector('.nav-items a') as HTMLAnchorElement;
    expect(link.textContent).toContain('角色 AppRole');
    expect(link.getAttribute('href')).toBe('/app-roles');
  });

  it('collapses a nav group when its header is clicked', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('.nav-group') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.nav-items')).toBeNull();
  });
});
