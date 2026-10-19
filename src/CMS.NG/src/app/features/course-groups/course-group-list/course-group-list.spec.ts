import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { CourseGroup } from '../course-group.model';
import { CourseGroupService } from '../course-group.service';
import { CourseGroupList, FILTERS_KEY, PAGE_KEY, SORT_KEY } from './course-group-list';

describe('CourseGroupList', () => {
  let fixture: ComponentFixture<CourseGroupList>;
  let component: CourseGroupList;
  let service: jasmine.SpyObj<CourseGroupService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  const windows: CourseGroup = { pkid: 1, description: 'Windows Server', courseCount: 12, partnerCourseGroupCount: 1 };
  const azure: CourseGroup = { pkid: 2, description: 'Azure 雲端', courseCount: 0, partnerCourseGroupCount: 0 };
  const ccna: CourseGroup = { pkid: 3, description: 'CCNA', courseCount: 0, partnerCourseGroupCount: 2 };
  // p-table sorts [value] in place, so tests reference rows by name, not index.
  const groups: CourseGroup[] = [ccna, azure, windows];

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(CourseGroupList);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function acceptConfirm(): jasmine.Spy {
    return spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.accept?.();
      return confirmation;
    });
  }

  beforeEach(async () => {
    sessionStorage.clear();
    service = jasmine.createSpyObj<CourseGroupService>('CourseGroupService', ['query', 'delete']);
    service.query.and.callFake(() => of([...groups]));
    service.delete.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [CourseGroupList],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        ConfirmationService,
        MessageService,
        { provide: CourseGroupService, useValue: service },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => sessionStorage.clear());

  it('loads with empty filters and renders a row per group', async () => {
    await create();
    expect(service.query).toHaveBeenCalledOnceWith({ keyword: null });

    const rows = fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;
    expect(rows.length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Azure 雲端');
    expect(fixture.nativeElement.textContent).toContain('Windows Server');
  });

  it('defaults to sorting by pkid descending, 20 rows per page', async () => {
    await create();
    expect(component.sort).toEqual({ field: 'pkid', order: -1 });
    expect(component.page).toEqual({ first: 0, rows: 20 });
  });

  it('applyFilters() queries with the trimmed keyword and persists it to session storage', async () => {
    await create();
    service.query.calls.reset();

    component.openFilters();
    component.draft = { keyword: '  win ' };
    component.applyFilters();

    expect(service.query).toHaveBeenCalledOnceWith({ keyword: 'win' });
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!)).toEqual({ keyword: 'win' });
    expect(component.activeFilterCount()).toBe(1);
    expect(component.drawerVisible).toBeFalse();
  });

  it('clearFilters() resets the keyword', async () => {
    await create();
    component.draft = { keyword: 'x' };
    component.applyFilters();

    component.clearFilters();

    expect(component.filters()).toEqual({ keyword: null });
    expect(component.activeFilterCount()).toBe(0);
  });

  it('restores filters, sort and page from session storage', async () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'azure' }));
    sessionStorage.setItem(SORT_KEY, JSON.stringify({ field: 'description', order: 1 }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 20, rows: 10 }));

    await create();

    expect(service.query).toHaveBeenCalledOnceWith({ keyword: 'azure' });
    expect(component.sort).toEqual({ field: 'description', order: 1 });
    expect(component.page).toEqual({ first: 20, rows: 10 });
  });

  it('persists sort and paging changes', async () => {
    await create();
    component.onSort({ field: 'description', order: -1 });
    component.onRowsChange(50);
    component.onFirstChange(50);

    expect(JSON.parse(sessionStorage.getItem(SORT_KEY)!)).toEqual({ field: 'description', order: -1 });
    expect(JSON.parse(sessionStorage.getItem(PAGE_KEY)!)).toEqual({ first: 50, rows: 50 });
  });

  it('add() navigates to the new form', async () => {
    await create();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    component.add();
    expect(router.navigate).toHaveBeenCalledWith(['/course-groups/new']);
  });

  it('confirmDelete() shows pkid + description, deletes after confirmation and reloads', async () => {
    await create();
    const confirm = acceptConfirm();
    service.query.calls.reset();

    component.confirmDelete(azure);

    expect(confirm.calls.mostRecent().args[0].message).toBe('確定要刪除主代碼 <b>2</b>「Azure 雲端」？');
    expect(service.delete).toHaveBeenCalledOnceWith(2);
    expect(service.query).toHaveBeenCalledTimes(1);
  });

  it('treats any child count as in use and skips delete', async () => {
    await create();
    const confirm = acceptConfirm();

    expect(component.inUse(windows)).toBeTrue();
    expect(component.inUse(ccna)).toBeTrue();
    expect(component.inUse(azure)).toBeFalse();
    component.confirmDelete(ccna);

    expect(confirm).not.toHaveBeenCalled();
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('shows the server message when delete returns 409', async () => {
    await create();
    acceptConfirm();
    service.delete.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: '使用中，無法刪除' } })),
    );
    const add = spyOn(messages, 'add');

    component.confirmDelete(azure);

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '使用中，無法刪除' }));
  });

  it('shows an error toast when loading fails', async () => {
    service.query.and.returnValue(throwError(() => new Error('boom')));
    const add = spyOn(messages, 'add');
    await create();
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(component.loading()).toBeFalse();
  });
});
