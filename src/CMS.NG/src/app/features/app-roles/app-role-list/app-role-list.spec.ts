import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { AppRole } from '../app-role.model';
import { AppRoleService } from '../app-role.service';
import { AppRoleList, FILTERS_KEY, PAGE_KEY, SORT_KEY } from './app-role-list';

describe('AppRoleList', () => {
  let fixture: ComponentFixture<AppRoleList>;
  let component: AppRoleList;
  let service: jasmine.SpyObj<AppRoleService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  const roles: AppRole[] = [
    { pkid: 1, roleId: 'Admin', roleName: 'Administrator', permissionLevel: 1, description: '系統管理員', userCount: 3, users: [] },
    { pkid: 2, roleId: 'User', roleName: 'User', permissionLevel: 100, description: '一般使用者', userCount: 0, users: [] },
  ];

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(AppRoleList);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    sessionStorage.clear();
    service = jasmine.createSpyObj<AppRoleService>('AppRoleService', ['query', 'delete']);
    service.query.and.returnValue(of(roles));
    service.delete.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [AppRoleList],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        ConfirmationService,
        MessageService,
        { provide: AppRoleService, useValue: service },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => sessionStorage.clear());

  it('loads roles with empty filters and renders a row per role', async () => {
    await create();
    expect(service.query).toHaveBeenCalledOnceWith({ keyword: null, permissionLevelFrom: null, permissionLevelTo: null });

    const rows = fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Admin');
    expect(rows[0].textContent).toContain('系統管理員');
  });

  it('defaults to sorting by roleId ascending, 20 rows per page', async () => {
    await create();
    expect(component.sort).toEqual({ field: 'roleId', order: 1 });
    expect(component.page).toEqual({ first: 0, rows: 20 });
  });

  it('applyFilters() queries with the draft filter and persists it to session storage', async () => {
    await create();
    service.query.calls.reset();

    component.openFilters();
    component.draft = { keyword: '  adm ', permissionLevelFrom: 1, permissionLevelTo: 50 };
    component.applyFilters();

    const expected = { keyword: 'adm', permissionLevelFrom: 1, permissionLevelTo: 50 };
    expect(service.query).toHaveBeenCalledOnceWith(expected);
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!)).toEqual(expected);
    expect(component.activeFilterCount()).toBe(3);
    expect(component.drawerVisible).toBeFalse();
    expect(component.page.first).toBe(0);
  });

  it('clearFilters() resets all filters', async () => {
    await create();
    component.draft = { keyword: 'x', permissionLevelFrom: 5, permissionLevelTo: null };
    component.applyFilters();

    component.clearFilters();

    expect(component.filters()).toEqual({ keyword: null, permissionLevelFrom: null, permissionLevelTo: null });
    expect(component.activeFilterCount()).toBe(0);
  });

  it('restores filters, sort and page from session storage', async () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'user' }));
    sessionStorage.setItem(SORT_KEY, JSON.stringify({ field: 'permissionLevel', order: -1 }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 20, rows: 10 }));

    await create();

    expect(service.query).toHaveBeenCalledOnceWith(jasmine.objectContaining({ keyword: 'user' }));
    expect(component.sort).toEqual({ field: 'permissionLevel', order: -1 });
    expect(component.page).toEqual({ first: 20, rows: 10 });
  });

  it('persists sort and paging changes', async () => {
    await create();
    component.onSort({ field: 'roleName', order: -1 });
    component.onRowsChange(50);
    component.onFirstChange(50);

    expect(JSON.parse(sessionStorage.getItem(SORT_KEY)!)).toEqual({ field: 'roleName', order: -1 });
    expect(JSON.parse(sessionStorage.getItem(PAGE_KEY)!)).toEqual({ first: 50, rows: 50 });
  });

  it('add() navigates to the new-role form', async () => {
    await create();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    component.add();
    expect(router.navigate).toHaveBeenCalledWith(['/app-roles/new']);
  });

  it('confirmDelete() deletes after confirmation and reloads', async () => {
    await create();
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.accept?.();
      return confirmation;
    });
    service.query.calls.reset();

    component.confirmDelete(roles[1]);

    expect(service.delete).toHaveBeenCalledOnceWith(2);
    expect(service.query).toHaveBeenCalledTimes(1);
  });

  it('confirmDelete() does nothing when rejected', async () => {
    await create();
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.reject?.();
      return confirmation;
    });
    component.confirmDelete(roles[0]);
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('shows an error toast when loading fails', async () => {
    service.query.and.returnValue(throwError(() => new Error('boom')));
    const add = spyOn(messages, 'add');
    await create();
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(component.loading()).toBeFalse();
  });
});
