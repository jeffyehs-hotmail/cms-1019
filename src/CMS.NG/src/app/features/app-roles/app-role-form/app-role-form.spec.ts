import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RowAuditService } from '../../../core/components/row-audit-badge/row-audit.service';
import { MessageService } from 'primeng/api';
import { LookupService } from '../../../core/services/lookup.service';
import { AppRole } from '../app-role.model';
import { AppRoleService } from '../app-role.service';
import { AppRoleForm } from './app-role-form';

describe('AppRoleForm', () => {
  let fixture: ComponentFixture<AppRoleForm>;
  let component: AppRoleForm;
  let service: jasmine.SpyObj<AppRoleService>;
  let lookups: jasmine.SpyObj<LookupService>;
  let router: Router;
  let messages: MessageService;

  const users = [
    { pkid: 10, userId: 'alice', userName: 'Alice' },
    { pkid: 11, userId: 'bob', userName: 'Bob' },
  ];

  const role: AppRole = {
    pkid: 1,
    roleId: 'Admin',
    roleName: 'Administrator',
    permissionLevel: 1,
    description: '系統管理員',
    userCount: 1,
    users: [users[0]],
  };

  function create(id?: string): void {
    fixture = TestBed.createComponent(AppRoleForm);
    component = fixture.componentInstance;
    if (id) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj<AppRoleService>('AppRoleService', ['getById', 'create', 'update']);
    lookups = jasmine.createSpyObj<LookupService>('LookupService', ['getAppUsers']);
    lookups.getAppUsers.and.returnValue(of(users));
    service.getById.and.returnValue(of(role));
    service.create.and.callFake((req) => of({ ...role, ...req, pkid: 7, users: [] }));
    service.update.and.callFake((req) => of({ ...role, roleName: req.roleName }));

    await TestBed.configureTestingModule({
      imports: [AppRoleForm],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: AppRoleService, useValue: service },
        { provide: RowAuditService, useValue: jasmine.createSpyObj<RowAuditService>('RowAuditService', { getHistory: of([]) }) },
        { provide: LookupService, useValue: lookups },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    messages = TestBed.inject(MessageService);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  describe('add mode', () => {
    beforeEach(() => create());

    it('starts empty with PermissionLevel defaulting to 100 and RoleId enabled', () => {
      expect(component.isEdit()).toBeFalse();
      expect(component.form.controls.permissionLevel.value).toBe(100);
      expect(component.form.controls.roleId.enabled).toBeTrue();
      expect(service.getById).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('新增角色');
    });

    it('loads user options as "UserName (UserId)"', () => {
      expect(component.userOptions()).toEqual([
        { userId: 'alice', label: 'Alice (alice)' },
        { userId: 'bob', label: 'Bob (bob)' },
      ]);
    });

    it('does not submit when required fields are missing, and shows errors', () => {
      component.save();
      fixture.detectChanges();

      expect(service.create).not.toHaveBeenCalled();
      expect(component.form.controls.roleId.touched).toBeTrue();
      expect(fixture.nativeElement.textContent).toContain('請輸入角色代碼');
      expect(fixture.nativeElement.textContent).toContain('請輸入角色名稱');
    });

    it('rejects a RoleId longer than 200 characters', () => {
      component.form.patchValue({ roleId: 'x'.repeat(201), roleName: 'n' });
      component.save();
      expect(service.create).not.toHaveBeenCalled();
      expect(component.form.controls.roleId.hasError('maxlength')).toBeTrue();
    });

    it('creates the role with a trimmed payload and navigates to its detail page', () => {
      component.form.patchValue({
        roleId: ' Auditor ',
        roleName: 'Auditor',
        permissionLevel: 80,
        description: '  ',
        userIds: ['bob'],
      });
      component.save();

      expect(service.create).toHaveBeenCalledOnceWith({
        pkid: 0,
        roleId: 'Auditor',
        roleName: 'Auditor',
        permissionLevel: 80,
        description: null,
        userIds: ['bob'],
      });
      expect(router.navigate).toHaveBeenCalledWith(['/app-roles', 7]);
    });

    it('shows the server message when RoleId already exists (409)', () => {
      service.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { message: "角色代碼 'Admin' 已存在" } })),
      );
      const add = spyOn(messages, 'add');
      component.form.patchValue({ roleId: 'Admin', roleName: 'x' });
      component.save();

      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: "角色代碼 'Admin' 已存在" }));
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });

    it('shows the server message when a member does not exist (400)', () => {
      service.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 400, error: { message: "使用者 'zz' 不存在" } })),
      );
      const add = spyOn(messages, 'add');
      component.form.patchValue({ roleId: 'R', roleName: 'x' });
      component.save();

      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: "使用者 'zz' 不存在" }));
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('leaves the 5xx toast to the interceptor (no second toast) when saving fails', () => {
      service.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500, error: { message: '系統發生未預期的錯誤，請稍後再試' } })),
      );
      const add = spyOn(messages, 'add');
      component.form.patchValue({ roleId: 'Admin', roleName: 'x' });
      component.save();

      expect(add).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });

    it('cancel() returns to the list', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/app-roles']);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => create('1'));

    it('loads the role and lookups in parallel and patches the form', () => {
      expect(service.getById).toHaveBeenCalledOnceWith(1);
      expect(lookups.getAppUsers).toHaveBeenCalledTimes(1);
      expect(component.form.getRawValue()).toEqual({
        roleId: 'Admin',
        roleName: 'Administrator',
        permissionLevel: 1,
        description: '系統管理員',
        userIds: ['alice'],
      });
      expect(fixture.nativeElement.textContent).toContain('編輯角色');
    });

    it('disables RoleId (immutable primary key)', () => {
      expect(component.form.controls.roleId.disabled).toBeTrue();
      const input = fixture.nativeElement.querySelector('#roleId') as HTMLInputElement;
      expect(input.disabled).toBeTrue();
    });

    it('updates with pkid in the body and navigates to the detail page', () => {
      component.form.patchValue({ roleName: 'Super Admin', userIds: ['alice', 'bob'] });
      component.save();

      expect(service.update).toHaveBeenCalledOnceWith({
        pkid: 1,
        roleId: 'Admin',
        roleName: 'Super Admin',
        permissionLevel: 1,
        description: '系統管理員',
        userIds: ['alice', 'bob'],
      });
      expect(service.create).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/app-roles', 1]);
    });

    it('cancel() returns to the detail page', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/app-roles', '1']);
    });
  });

  it('shows the 異動紀錄 badge only when editing an existing record', () => {
    create();
    expect(fixture.nativeElement.querySelector('app-row-audit-badge')).toBeNull();
    fixture.destroy();

    create('1');
    expect(fixture.nativeElement.querySelector('.page-header .start app-row-audit-badge')).not.toBeNull();
    expect(TestBed.inject(RowAuditService).getHistory).toHaveBeenCalledOnceWith('AppRole', '1');
  });
});
