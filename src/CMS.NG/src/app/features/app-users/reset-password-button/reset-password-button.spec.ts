import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/auth.service';
import { AppUserService } from '../app-user.service';
import { ResetPasswordButton } from './reset-password-button';

describe('ResetPasswordButton', () => {
  let fixture: ComponentFixture<ResetPasswordButton>;
  let service: jasmine.SpyObj<AppUserService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;
  const isAdmin = signal(true);

  function create(): HTMLElement {
    fixture = TestBed.createComponent(ResetPasswordButton);
    fixture.componentRef.setInput('pkid', 1);
    fixture.componentRef.setInput('userId', 'alice');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const button = (el: HTMLElement) => el.querySelector('[data-action="reset-password"]');

  const answerConfirm = (accept: boolean) =>
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      if (accept) c.accept?.();
      else c.reject?.();
      return confirmation;
    });

  beforeEach(async () => {
    isAdmin.set(true);
    service = jasmine.createSpyObj<AppUserService>('AppUserService', ['resetPassword']);
    service.resetPassword.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [ResetPasswordButton],
      providers: [
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: AppUserService, useValue: service },
        { provide: AuthService, useValue: { isAdmin } },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  it('shows the button to Admins', () => {
    expect(button(create())).not.toBeNull();
  });

  it('hides the button from non-Admins', () => {
    isAdmin.set(false);
    expect(button(create())).toBeNull();
  });

  it('asks for confirmation naming the user', () => {
    create();
    const confirm = answerConfirm(false);
    fixture.componentInstance.confirmReset();
    expect(confirm).toHaveBeenCalledWith(jasmine.objectContaining({ message: jasmine.stringContaining('alice') }));
  });

  it('resets by pkid only after confirmation, toasts and emits reset', () => {
    create();
    answerConfirm(true);
    const add = spyOn(messages, 'add');
    let emitted = 0;
    fixture.componentInstance.reset.subscribe(() => emitted++);

    fixture.componentInstance.confirmReset();

    expect(service.resetPassword).toHaveBeenCalledOnceWith(1);
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
    expect(emitted).toBe(1);
    expect(fixture.componentInstance.resetting()).toBeFalse();
  });

  it('does nothing when rejected', () => {
    create();
    answerConfirm(false);
    fixture.componentInstance.confirmReset();
    expect(service.resetPassword).not.toHaveBeenCalled();
  });

  it('shows the API message (e.g. 403) and does not emit when reset fails', () => {
    service.resetPassword.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { message: '權限不足，無法執行此操作' } })),
    );
    create();
    answerConfirm(true);
    const add = spyOn(messages, 'add');
    let emitted = 0;
    fixture.componentInstance.reset.subscribe(() => emitted++);

    fixture.componentInstance.confirmReset();

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '權限不足，無法執行此操作' }));
    expect(emitted).toBe(0);
    expect(fixture.componentInstance.resetting()).toBeFalse();
  });

  it('leaves the 5xx toast to the interceptor (no second toast) when reset fails', () => {
    service.resetPassword.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: '系統發生未預期的錯誤，請稍後再試' } })),
    );
    create();
    answerConfirm(true);
    const add = spyOn(messages, 'add');
    let emitted = 0;
    fixture.componentInstance.reset.subscribe(() => emitted++);

    fixture.componentInstance.confirmReset();

    expect(add).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(emitted).toBe(0);
    expect(fixture.componentInstance.resetting()).toBeFalse();
  });
});
