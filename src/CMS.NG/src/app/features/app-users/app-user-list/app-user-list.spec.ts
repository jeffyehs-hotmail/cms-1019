import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { LookupService } from '../../../core/services/lookup.service';
import { AppUser } from '../app-user.model';
import { AppUserService } from '../app-user.service';
import { AppUserList, FILTERS_KEY, PAGE_KEY, SORT_KEY } from './app-user-list';

describe('AppUserList', () => {
  let fixture: ComponentFixture<AppUserList>;
  let component: AppUserList;
  let service: jasmine.SpyObj<AppUserService>;
  let lookups: jasmine.SpyObj<LookupService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  const base: AppUser = {
    pkid: 0,
    userId: '',
    userName: '',
    isActive: true,
    passwordUpdatedTime: null,
    roleCount: 0,
    hasAgentToken: false,
    agentTokenUsageCount: 0,
    roles: [],
  };
  const alice: AppUser = { ...base, pkid: 1, userId: 'alice', userName: 'Alice', roleCount: 2 };
  const bob: AppUser = { ...base, pkid: 2, userId: 'bob', userName: 'Bob', isActive: false };
  const rows = [alice, bob];

  async function create(roleId?: string): Promise<void> {
    fixture = TestBed.createComponent(AppUserList);
    component = fixture.componentInstance;
    if (roleId !== undefined) fixture.componentRef.setInput('roleId', roleId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    sessionStorage.clear();
    service = jasmine.createSpyObj<AppUserService>('AppUserService', ['query', 'delete']);
    service.query.and.callFake(() => of([...rows]));
    service.delete.and.returnValue(of(undefined));
    lookups = jasmine.createSpyObj<LookupService>('LookupService', ['getAppRoles']);
    lookups.getAppRoles.and.returnValue(of([{ pkid: 1, roleId: 'Admin', roleName: 'Administrator' }]));

    await TestBed.configureTestingModule({
      imports: [AppUserList],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        ConfirmationService,
        MessageService,
        { provide: AppUserService, useValue: service },
        { provide: LookupService, useValue: lookups },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => sessionStorage.clear());

  it('loads users with empty filters and renders a row per user', async () => {
    await create();
    expect(service.query).toHaveBeenCalledOnceWith({ keyword: null, isActive: null, roleId: null });

    const trs = fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;
    expect(trs.length).toBe(2);
    expect(trs[0].textContent).toContain('alice');
    expect(trs[0].textContent).toContain('Alice');
  });

  it('never renders a password hash column', async () => {
    await create();
    const header = (fixture.nativeElement as HTMLElement).querySelector('thead')!.textContent!;
    expect(header).not.toContain('PasswordHash');
    expect(header).toContain('密碼更新時間');
  });

  it('defaults to sorting by userId ascending, 20 rows per page', async () => {
    await create();
    expect(component.sort).toEqual({ field: 'userId', order: 1 });
    expect(component.page).toEqual({ first: 0, rows: 20 });
  });

  it('loads role options only when the drawer first opens', async () => {
    await create();
    expect(lookups.getAppRoles).not.toHaveBeenCalled();

    component.openFilters();
    component.openFilters();

    expect(lookups.getAppRoles).toHaveBeenCalledTimes(1);
    expect(component.roleOptions()).toEqual([{ roleId: 'Admin', label: 'Administrator (Admin)' }]);
  });

  it('applyFilters() queries with the draft filter and persists it', async () => {
    await create();
    service.query.calls.reset();

    component.openFilters();
    component.draft = { keyword: '  ali ', isActive: false, roleId: 'Admin' };
    component.applyFilters();

    const expected = { keyword: 'ali', isActive: false, roleId: 'Admin' };
    expect(service.query).toHaveBeenCalledOnceWith(expected);
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!)).toEqual(expected);
    expect(component.activeFilterCount()).toBe(3);
    expect(component.drawerVisible).toBeFalse();
    expect(component.page.first).toBe(0);
  });

  it('clearFilters() resets all filters', async () => {
    await create();
    component.draft = { keyword: 'x', isActive: true, roleId: 'Admin' };
    component.applyFilters();

    component.clearFilters();

    expect(component.filters()).toEqual({ keyword: null, isActive: null, roleId: null });
    expect(component.activeFilterCount()).toBe(0);
  });

  it('restores filters, sort and page from session storage', async () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'bob', isActive: null, roleId: null }));
    sessionStorage.setItem(SORT_KEY, JSON.stringify({ field: 'userName', order: -1 }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 20, rows: 10 }));

    await create();

    expect(service.query).toHaveBeenCalledOnceWith(jasmine.objectContaining({ keyword: 'bob' }));
    expect(component.sort).toEqual({ field: 'userName', order: -1 });
    expect(component.page).toEqual({ first: 20, rows: 10 });
  });

  it('a roleId query param replaces the saved filters and resets paging', async () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'bob', isActive: true, roleId: null }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 40, rows: 20 }));

    await create('Admin');

    expect(service.query).toHaveBeenCalledOnceWith({ keyword: null, isActive: null, roleId: 'Admin' });
    expect(component.page.first).toBe(0);
  });

  it('persists sort and paging changes', async () => {
    await create();
    component.onSort({ field: 'userName', order: -1 });
    component.onRowsChange(50);
    component.onFirstChange(50);

    expect(JSON.parse(sessionStorage.getItem(SORT_KEY)!)).toEqual({ field: 'userName', order: -1 });
    expect(JSON.parse(sessionStorage.getItem(PAGE_KEY)!)).toEqual({ first: 50, rows: 50 });
  });

  it('add() navigates to the new-user form', async () => {
    await create();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    component.add();
    expect(router.navigate).toHaveBeenCalledWith(['/app-users/new']);
  });

  it('confirmDelete() shows pkid and name, deletes after confirmation and reloads', async () => {
    await create();
    let message = '';
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      message = c.message ?? '';
      c.accept?.();
      return confirmation;
    });
    service.query.calls.reset();

    component.confirmDelete(alice);

    expect(message).toContain('<b>1</b>');
    expect(message).toContain('alice Alice');
    expect(message).toContain('2 個角色');
    expect(service.delete).toHaveBeenCalledOnceWith(1);
    expect(service.query).toHaveBeenCalledTimes(1);
  });

  it('confirmDelete() does nothing when rejected', async () => {
    await create();
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.reject?.();
      return confirmation;
    });
    component.confirmDelete(bob);
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('shows an error toast when loading fails', async () => {
    service.query.and.returnValue(throwError(() => new Error('boom')));
    const add = spyOn(messages, 'add');
    await create();
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(component.loading()).toBeFalse();
  });

  it('leaves the 5xx toast to the interceptor (no second toast) when loading fails', async () => {
    service.query.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: '系統發生未預期的錯誤，請稍後再試' } })),
    );
    const add = spyOn(messages, 'add');
    await create();
    expect(add).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(component.loading()).toBeFalse();
  });
});
