import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/auth.service';
import { LookupService } from '../../../core/services/lookup.service';
import { AppUser } from '../app-user.model';
import { AppUserService } from '../app-user.service';
import { AppUserForm } from './app-user-form';

describe('AppUserForm', () => {
  let fixture: ComponentFixture<AppUserForm>;
  let component: AppUserForm;
  let service: jasmine.SpyObj<AppUserService>;
  let lookups: jasmine.SpyObj<LookupService>;
  let router: Router;
  let messages: MessageService;
  const isAdmin = signal(true);

  const roles = [
    { pkid: 1, roleId: 'Admin', roleName: 'Administrator' },
    { pkid: 2, roleId: 'User', roleName: 'User' },
  ];

  const user: AppUser = {
    pkid: 1,
    userId: 'alice',
    userName: 'Alice',
    isActive: false,
    passwordUpdatedTime: null,
    roleCount: 1,
    hasAgentToken: false,
    agentTokenUsageCount: 0,
    roles: [roles[0]],
  };

  function create(id?: string): void {
    fixture = TestBed.createComponent(AppUserForm);
    component = fixture.componentInstance;
    if (id) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    isAdmin.set(true);
    service = jasmine.createSpyObj<AppUserService>('AppUserService', ['getById', 'create', 'update']);
    lookups = jasmine.createSpyObj<LookupService>('LookupService', ['getAppRoles']);
    lookups.getAppRoles.and.returnValue(of(roles));
    service.getById.and.returnValue(of(user));
    service.create.and.callFake((req) => of({ ...user, ...req, pkid: 7, roles: [] }));
    service.update.and.callFake((req) => of({ ...user, userName: req.userName }));

    await TestBed.configureTestingModule({
      imports: [AppUserForm],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: AuthService, useValue: { isAdmin } },
        { provide: AppUserService, useValue: service },
        { provide: LookupService, useValue: lookups },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    messages = TestBed.inject(MessageService);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  describe('add mode', () => {
    beforeEach(() => create());

    it('starts empty, active, with UserId enabled and a default-password hint', () => {
      expect(component.isEdit()).toBeFalse();
      expect(component.form.controls.isActive.value).toBeTrue();
      expect(component.form.controls.userId.enabled).toBeTrue();
      expect(service.getById).not.toHaveBeenCalled();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('新增使用者');
      expect(el.querySelector('[data-hint="password"]')).not.toBeNull();
    });

    it('has no password control', () => {
      expect(Object.keys(component.form.controls).some((k) => /password/i.test(k))).toBeFalse();
      expect((fixture.nativeElement as HTMLElement).querySelector('input[type="password"]')).toBeNull();
    });

    it('loads role options as "RoleName (RoleId)"', () => {
      expect(component.roleOptions()).toEqual([
        { roleId: 'Admin', label: 'Administrator (Admin)' },
        { roleId: 'User', label: 'User (User)' },
      ]);
    });

    it('requires UserId and UserName', () => {
      component.save();
      expect(component.form.controls.userId.hasError('required')).toBeTrue();
      expect(component.form.controls.userName.hasError('required')).toBeTrue();
      expect(service.create).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only and over-long values', () => {
      component.form.patchValue({ userId: '   ', userName: 'x'.repeat(201) });
      component.save();
      expect(component.form.controls.userId.hasError('pattern')).toBeTrue();
      expect(component.form.controls.userName.hasError('maxlength')).toBeTrue();
      expect(service.create).not.toHaveBeenCalled();
    });

    it('creates with a trimmed request and navigates to the new record', () => {
      component.form.patchValue({ userId: ' dave ', userName: ' Dave ', isActive: true, roleIds: ['User'] });
      component.save();

      expect(service.create).toHaveBeenCalledOnceWith({
        pkid: 0,
        userId: 'dave',
        userName: 'Dave',
        isActive: true,
        roleIds: ['User'],
      });
      expect(router.navigate).toHaveBeenCalledWith(['/app-users', 7]);
    });

    it('shows the API message on 409', () => {
      service.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { message: "使用者帳號 'dave' 已存在" } })),
      );
      const add = spyOn(messages, 'add');
      component.form.patchValue({ userId: 'dave', userName: 'Dave' });
      component.save();

      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: "使用者帳號 'dave' 已存在" }));
      expect(component.saving()).toBeFalse();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  const resetButton = () => (fixture.nativeElement as HTMLElement).querySelector('[data-action="reset-password"]');

  it('hides 重設密碼 in add mode', () => {
    create();
    expect(resetButton()).toBeNull();
  });

  it('hides 重設密碼 in edit mode from non-Admins', () => {
    isAdmin.set(false);
    create('1');
    expect(resetButton()).toBeNull();
  });

  describe('edit mode', () => {
    beforeEach(() => create('1'));

    it('shows 重設密碼 to Admins once the user is loaded', () => {
      expect(resetButton()).not.toBeNull();
    });

    it('loads the record, patches the form and disables UserId', () => {
      expect(service.getById).toHaveBeenCalledOnceWith(1);
      expect(lookups.getAppRoles).toHaveBeenCalledTimes(1);
      expect(component.form.getRawValue()).toEqual({
        userId: 'alice',
        userName: 'Alice',
        isActive: false,
        roleIds: ['Admin'],
      });
      expect(component.form.controls.userId.disabled).toBeTrue();
      expect(fixture.nativeElement.textContent).toContain('編輯使用者');
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-hint="password"]')).toBeNull();
    });

    it('updates with pkid from the route and the original UserId', () => {
      component.form.patchValue({ userName: 'Alice Chen', roleIds: ['Admin', 'User'] });
      component.save();

      expect(service.update).toHaveBeenCalledOnceWith({
        pkid: 1,
        userId: 'alice',
        userName: 'Alice Chen',
        isActive: false,
        roleIds: ['Admin', 'User'],
      });
      expect(router.navigate).toHaveBeenCalledWith(['/app-users', 1]);
    });

    it('cancel() returns to the detail page', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/app-users', '1']);
    });
  });
});
