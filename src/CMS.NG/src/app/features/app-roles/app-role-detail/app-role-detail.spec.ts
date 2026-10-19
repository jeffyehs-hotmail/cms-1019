import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
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
      providers: [provideRouter([]), MessageService, { provide: AppRoleService, useValue: service }],
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

  it('shows a not-found message on 404', () => {
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const el = create('999');
    expect(el.textContent).toContain('找不到此角色資料');
    expect(el.querySelector('[data-field="roleId"]')).toBeNull();
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
});
