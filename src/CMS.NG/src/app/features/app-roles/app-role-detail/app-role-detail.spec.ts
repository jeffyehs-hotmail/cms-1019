import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RowAuditService } from '../../../core/components/row-audit-badge/row-audit.service';
import { MessageService } from 'primeng/api';
import { AppRole } from '../app-role.model';
import { AppRoleService } from '../app-role.service';
import { AppRoleDetail } from './app-role-detail';

describe('AppRoleDetail', () => {
  let fixture: ComponentFixture<AppRoleDetail>;
  let service: jasmine.SpyObj<AppRoleService>;

  const role: AppRole = {
    pkid: 1,
    roleId: 'Admin',
    roleName: 'Administrator',
    permissionLevel: 1,
    description: '系統管理員',
    userCount: 2,
    users: [
      { pkid: 10, userId: 'alice', userName: 'Alice' },
      { pkid: 11, userId: 'bob', userName: 'Bob' },
    ],
  };

  function create(id = '1'): HTMLElement {
    fixture = TestBed.createComponent(AppRoleDetail);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj<AppRoleService>('AppRoleService', ['getById']);
    service.getById.and.returnValue(of(role));

    await TestBed.configureTestingModule({
      imports: [AppRoleDetail],
      providers: [provideRouter([]), MessageService, { provide: AppRoleService, useValue: service }, { provide: RowAuditService, useValue: jasmine.createSpyObj<RowAuditService>('RowAuditService', { getHistory: of([]) }) }],
    }).compileComponents();
  });

  it('loads the role by route id and renders its fields', () => {
    const el = create('1');
    expect(service.getById).toHaveBeenCalledOnceWith(1);
    const text = (f: string) => el.querySelector(`[data-field="${f}"]`)?.textContent?.trim();
    expect(text('roleId')).toBe('Admin');
    expect(text('roleName')).toBe('Administrator');
    expect(text('permissionLevel')).toBe('1');
    expect(text('description')).toBe('系統管理員');
  });

  it('lists assigned users', () => {
    const el = create();
    const chips = el.querySelectorAll('p-chip');
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toContain('Alice (alice)');
  });

  it('links the user count to the user list filtered by role', () => {
    const el = create();
    const link = el.querySelector('[data-field="userCount"]') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('(2)');
    expect(link.getAttribute('href')).toBe('/app-users?roleId=Admin');
  });

  it('shows a not-found message on 404', () => {
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const el = create('999');
    expect(el.textContent).toContain('找不到此角色資料');
    expect(el.querySelector('[data-field="roleId"]')).toBeNull();
  });

  // Regression: ISSUE-002 — load errors toasted a fixed text instead of the API 403 message.
  // Found by /qa on 2026-10-22
  // Report: .gstack/qa-reports/run-20261022T060024Z/qa-report-cms-2026-10-22.md
  it('toasts the API message when loading is refused (403 for a non-admin)', () => {
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403, error: { message: '權限不足，無法執行此操作' } })));
    const add = spyOn(TestBed.inject(MessageService), 'add');
    create('1');
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '權限不足，無法執行此操作' }));
  });

  it('leaves the 5xx toast to the interceptor (no second toast) when loading fails', () => {
    service.getById.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: '系統發生未預期的錯誤，請稍後再試' } })),
    );
    const add = spyOn(TestBed.inject(MessageService), 'add');
    create('1');
    expect(add).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(fixture.componentInstance.notFound()).toBeTrue();
  });

  it('edit() navigates to the edit page; back() to the list', () => {
    create('1');
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture.componentInstance.edit();
    expect(router.navigate).toHaveBeenCalledWith(['/app-roles', '1', 'edit']);

    fixture.componentInstance.back();
    expect(router.navigate).toHaveBeenCalledWith(['/app-roles']);
  });

  it('shows the 異動紀錄 badge for this record in the page header', () => {
    const el = create('1');
    expect(el.querySelector('.page-header .start app-row-audit-badge')).not.toBeNull();
    expect(TestBed.inject(RowAuditService).getHistory).toHaveBeenCalledOnceWith('AppRole', '1');
  });
});
