import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Login, safeReturnUrl } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;
  let messages: MessageService;

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    messages = TestBed.inject(MessageService);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
  });

  function fill(userId: string, password: string): void {
    const el = fixture.nativeElement as HTMLElement;
    for (const [id, value] of [['userId', userId], ['password', password]]) {
      const input = el.querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
  }

  function submit(): void {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('renders 帳號 / 密碼 and a password-type input', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('帳號');
    expect(el.textContent).toContain('密碼');
    expect((el.querySelector('#password') as HTMLInputElement).type).toBe('password');
  });

  it('does not call the API while fields are empty', () => {
    submit();

    expect(auth.login).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('請輸入帳號');
  });

  it('logs in with { userId, password } and goes to the returnUrl', () => {
    auth.login.and.returnValue(of({ userId: 'alice', userName: 'Alice', accessToken: 't' }));
    fixture.componentRef.setInput('returnUrl', '/courses/5');

    fill('alice', 'pw');
    submit();

    expect(auth.login).toHaveBeenCalledWith({ userId: 'alice', password: 'pw' });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/courses/5');
  });

  it('goes home when there is no returnUrl', () => {
    auth.login.and.returnValue(of({ userId: 'alice', userName: 'Alice', accessToken: 't' }));

    fill('alice', 'pw');
    submit();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('toasts the API message on 401 and stays on the page', () => {
    auth.login.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401, error: { message: '帳號或密碼錯誤' } })),
    );
    const add = spyOn(messages, 'add');

    fill('alice', 'bad');
    submit();

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '帳號或密碼錯誤' }));
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('leaves the 5xx toast to the interceptor (no second toast) when login fails, and stays on the page', () => {
    auth.login.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: '系統發生未預期的錯誤，請稍後再試' } })),
    );
    const add = spyOn(messages, 'add');

    fill('alice', 'bad');
    submit();

    expect(add).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('safeReturnUrl only allows same-app paths', () => {
    expect(safeReturnUrl('/courses?x=1')).toBe('/courses?x=1');
    expect(safeReturnUrl(undefined)).toBe('/');
    expect(safeReturnUrl('https://evil.example')).toBe('/');
    expect(safeReturnUrl('//evil.example')).toBe('/');
    expect(safeReturnUrl('/\\evil.example')).toBe('/');
    expect(safeReturnUrl('/login?returnUrl=%2F')).toBe('/');
  });
});
