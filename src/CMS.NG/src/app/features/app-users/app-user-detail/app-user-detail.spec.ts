import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { AppUser } from '../app-user.model';
import { AppUserService } from '../app-user.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ResetPasswordButton } from '../reset-password-button/reset-password-button';
import { AppUserDetail } from './app-user-detail';

describe('AppUserDetail', () => {
  let fixture: ComponentFixture<AppUserDetail>;
  let service: jasmine.SpyObj<AppUserService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;
  const isAdmin = signal(true);

  const user: AppUser = {
    pkid: 1,
    userId: 'alice',
    userName: 'Alice',
    isActive: true,
    passwordUpdatedTime: null,
    roleCount: 2,
    hasAgentToken: false,
    agentTokenUsageCount: 0,
    roles: [
      { pkid: 1, roleId: 'Admin', roleName: 'Administrator' },
      { pkid: 2, roleId: 'User', roleName: 'User' },
    ],
  };

  function create(id = '1'): HTMLElement {
    fixture = TestBed.createComponent(AppUserDetail);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (el: HTMLElement, f: string) => el.querySelector(`[data-field="${f}"]`)?.textContent?.trim();

  beforeEach(async () => {
    isAdmin.set(true);
    service = jasmine.createSpyObj<AppUserService>('AppUserService', [
      'getById',
      'regenerateAgentToken',
      'revokeAgentToken',
    ]);
    service.getById.and.returnValue(of(user));
    service.regenerateAgentToken.and.returnValue(of({ token: 'cms_at_new' }));
    service.revokeAgentToken.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [AppUserDetail],
      providers: [
        provideRouter([]),
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

  it('loads the user by route id and renders its fields', () => {
    const el = create('1');
    expect(service.getById).toHaveBeenCalledOnceWith(1);
    expect(text(el, 'userId')).toBe('alice');
    expect(text(el, 'userName')).toBe('Alice');
    expect(text(el, 'isActive')).toBe('是');
    expect(text(el, 'passwordUpdatedTime')).toContain('尚未變更');
  });

  it('formats the password update time when present', () => {
    service.getById.and.returnValue(of({ ...user, passwordUpdatedTime: '2026-03-05T14:07:00' }));
    const el = create();
    expect(text(el, 'passwordUpdatedTime')).toBe('2026-03-05 14:07');
  });

  it('lists assigned roles', () => {
    const el = create();
    const chips = el.querySelectorAll('p-chip');
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toContain('Administrator (Admin)');
  });

  it('shows not-found message on 404 without an error toast', () => {
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const add = spyOn(messages, 'add');
    const el = create('99');
    expect(el.textContent).toContain('找不到此使用者資料');
    expect(add).not.toHaveBeenCalled();
  });

  it('edit() navigates to the edit form', () => {
    create('1');
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.componentInstance.edit();
    expect(router.navigate).toHaveBeenCalledWith(['/app-users', '1', 'edit']);
  });

  it('shows 重設密碼 to Admins and reloads after a reset', () => {
    const el = create('1');
    const button = fixture.debugElement.query(By.directive(ResetPasswordButton));
    expect(el.querySelector('[data-action="reset-password"]')).not.toBeNull();
    service.getById.calls.reset();

    (button.componentInstance as ResetPasswordButton).reset.emit();

    expect(service.getById).toHaveBeenCalledOnceWith(1);
  });

  it('hides 重設密碼 from non-Admins', () => {
    isAdmin.set(false);
    const el = create('1');
    expect(el.querySelector('[data-action="reset-password"]')).toBeNull();
  });

  // ---------- Agent token ----------

  const acceptConfirm = () =>
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.accept?.();
      return confirmation;
    });

  it('shows the agent token status and hides revoke without a token', () => {
    const el = create();
    expect(text(el, 'hasAgentToken')).toBe('未設定');
    expect(el.querySelector('[data-action="revoke-agent-token"]')).toBeNull();

    service.getById.and.returnValue(of({ ...user, hasAgentToken: true }));
    const el2 = create();
    expect(text(el2, 'hasAgentToken')).toBe('已設定');
    expect(el2.querySelector('[data-action="revoke-agent-token"]')).not.toBeNull();
  });

  it('regenerating without an existing token skips the confirm and shows the token once', () => {
    create('1');
    const confirm = spyOn(confirmation, 'confirm');
    service.getById.calls.reset();

    fixture.componentInstance.confirmRegenerateAgentToken();
    fixture.detectChanges();

    expect(confirm).not.toHaveBeenCalled();
    expect(service.regenerateAgentToken).toHaveBeenCalledOnceWith(1);
    expect(service.getById).toHaveBeenCalledTimes(1);
    const input = document.querySelector<HTMLInputElement>('[data-field="issuedToken"]');
    expect(input?.value).toBe('cms_at_new');

    fixture.componentInstance.closeTokenDialog();
    fixture.detectChanges();
    expect(fixture.componentInstance.issuedToken()).toBeNull();
  });

  it('regenerating an existing token asks for confirmation first', () => {
    service.getById.and.returnValue(of({ ...user, hasAgentToken: true }));
    create('1');
    const confirm = spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.reject?.();
      return confirmation;
    });

    fixture.componentInstance.confirmRegenerateAgentToken();

    expect(confirm).toHaveBeenCalled();
    expect(service.regenerateAgentToken).not.toHaveBeenCalled();
  });

  it('copyToken() writes the issued token to the clipboard', async () => {
    create('1');
    fixture.componentInstance.issuedToken.set('cms_at_new');
    const write = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    const add = spyOn(messages, 'add');

    await fixture.componentInstance.copyToken();

    expect(write).toHaveBeenCalledOnceWith('cms_at_new');
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
  });

  it('revoke clears the token after confirmation and reloads', () => {
    service.getById.and.returnValue(of({ ...user, hasAgentToken: true }));
    create('1');
    acceptConfirm();
    const add = spyOn(messages, 'add');

    fixture.componentInstance.confirmRevokeAgentToken();

    expect(service.revokeAgentToken).toHaveBeenCalledOnceWith(1);
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
  });

  it('shows the API message when regenerating fails', () => {
    service.regenerateAgentToken.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'not here' } })),
    );
    create('1');
    const add = spyOn(messages, 'add');

    fixture.componentInstance.confirmRegenerateAgentToken();

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: 'not here' }));
    expect(fixture.componentInstance.issuedToken()).toBeNull();
    expect(fixture.componentInstance.tokenBusy()).toBeFalse();
  });
});
