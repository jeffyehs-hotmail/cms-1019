import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { PublishStatus } from '../publish-status.model';
import { PublishStatusService } from '../publish-status.service';
import { FILTERS_KEY, PAGE_KEY, PublishStatusList, SORT_KEY } from './publish-status-list';

describe('PublishStatusList', () => {
  let fixture: ComponentFixture<PublishStatusList>;
  let component: PublishStatusList;
  let service: jasmine.SpyObj<PublishStatusService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  const statuses: PublishStatus[] = [
    { pkid: 1, description: '草稿', isDraft: true, isPublished: false, isDiscontinued: false, courseCount: 7, promotion2Count: 525 },
    { pkid: 4, description: '測試', isDraft: false, isPublished: false, isDiscontinued: false, courseCount: 0, promotion2Count: 0 },
  ];

  const emptyFilters = { keyword: null, isDraft: null, isPublished: null, isDiscontinued: null };

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(PublishStatusList);
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
    service = jasmine.createSpyObj<PublishStatusService>('PublishStatusService', ['query', 'delete']);
    service.query.and.returnValue(of(statuses));
    service.delete.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [PublishStatusList],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        ConfirmationService,
        MessageService,
        { provide: PublishStatusService, useValue: service },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => sessionStorage.clear());

  it('loads with empty filters and renders a row per status', async () => {
    await create();
    expect(service.query).toHaveBeenCalledOnceWith(emptyFilters);

    const rows = fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('草稿');
    expect(rows[0].textContent).toContain('525');
  });

  it('defaults to sorting by pkid ascending, 20 rows per page', async () => {
    await create();
    expect(component.sort).toEqual({ field: 'pkid', order: 1 });
    expect(component.page).toEqual({ first: 0, rows: 20 });
  });

  it('applyFilters() queries with the draft filter and persists it to session storage', async () => {
    await create();
    service.query.calls.reset();

    component.openFilters();
    component.draft = { keyword: '  草 ', isDraft: true, isPublished: null, isDiscontinued: false };
    component.applyFilters();

    const expected = { keyword: '草', isDraft: true, isPublished: null, isDiscontinued: false };
    expect(service.query).toHaveBeenCalledOnceWith(expected);
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!)).toEqual(expected);
    expect(component.activeFilterCount()).toBe(3);
    expect(component.drawerVisible).toBeFalse();
  });

  it('clearFilters() resets all filters', async () => {
    await create();
    component.draft = { keyword: 'x', isDraft: true, isPublished: null, isDiscontinued: null };
    component.applyFilters();

    component.clearFilters();

    expect(component.filters()).toEqual(emptyFilters);
    expect(component.activeFilterCount()).toBe(0);
  });

  it('restores filters, sort and page from session storage', async () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ isPublished: true }));
    sessionStorage.setItem(SORT_KEY, JSON.stringify({ field: 'description', order: -1 }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 20, rows: 10 }));

    await create();

    expect(service.query).toHaveBeenCalledOnceWith(jasmine.objectContaining({ isPublished: true }));
    expect(component.sort).toEqual({ field: 'description', order: -1 });
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
    expect(router.navigate).toHaveBeenCalledWith(['/publish-statuses/new']);
  });

  it('confirmDelete() shows pkid + description, deletes after confirmation and reloads', async () => {
    await create();
    const confirm = acceptConfirm();
    service.query.calls.reset();

    component.confirmDelete(statuses[1]);

    expect(confirm.calls.mostRecent().args[0].message).toBe('確定要刪除主代碼 <b>4</b>「測試」？');
    expect(service.delete).toHaveBeenCalledOnceWith(4);
    expect(service.query).toHaveBeenCalledTimes(1);
  });

  it('confirmDelete() is a no-op for a status in use', async () => {
    await create();
    const confirm = acceptConfirm();

    expect(component.inUse(statuses[0])).toBeTrue();
    component.confirmDelete(statuses[0]);

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

    component.confirmDelete(statuses[1]);

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
