import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { AppUser } from '../app-user.model';
import { AppUserService } from '../app-user.service';
import { AppUserDetail } from './app-user-detail';

describe('AppUserDetail', () => {
  let fixture: ComponentFixture<AppUserDetail>;
  let service: jasmine.SpyObj<AppUserService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  const user: AppUser = {
    pkid: 1,
    userId: 'alice',
    userName: 'Alice',
    isActive: true,
    passwordUpdatedTime: null,
    roleCount: 2,
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
    service = jasmine.createSpyObj<AppUserService>('AppUserService', ['getById', 'resetPassword']);
    service.getById.and.returnValue(of(user));
    service.resetPassword.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [AppUserDetail],
      providers: [
        provideRouter([]),
        MessageService,
        ConfirmationService,
        { provide: AppUserService, useValue: service },
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

  it('confirmResetPassword() resets after confirmation and reloads', () => {
    create('1');
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.accept?.();
      return confirmation;
    });
    const add = spyOn(messages, 'add');
    service.getById.calls.reset();

    fixture.componentInstance.confirmResetPassword();

    expect(service.resetPassword).toHaveBeenCalledOnceWith(1);
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
    expect(service.getById).toHaveBeenCalledTimes(1);
  });

  it('confirmResetPassword() does nothing when rejected', () => {
    create('1');
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.reject?.();
      return confirmation;
    });
    fixture.componentInstance.confirmResetPassword();
    expect(service.resetPassword).not.toHaveBeenCalled();
  });

  it('shows the API message when reset fails', () => {
    service.resetPassword.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: '系統設定 appConfig 缺少 defaultPassword' } })),
    );
    create('1');
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.accept?.();
      return confirmation;
    });
    const add = spyOn(messages, 'add');

    fixture.componentInstance.confirmResetPassword();

    expect(add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'error', detail: '系統設定 appConfig 缺少 defaultPassword' }),
    );
    expect(fixture.componentInstance.resetting()).toBeFalse();
  });
});
