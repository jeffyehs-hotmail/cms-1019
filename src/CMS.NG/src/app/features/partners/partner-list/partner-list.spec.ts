import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { Partner } from '../partner.model';
import { PartnerService } from '../partner.service';
import { FILTERS_KEY, PAGE_KEY, PartnerList, SORT_KEY } from './partner-list';

describe('PartnerList', () => {
  let fixture: ComponentFixture<PartnerList>;
  let component: PartnerList;
  let service: jasmine.SpyObj<PartnerService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  const unused = {
    courseCount: 0,
    certificationCount: 0,
    partnerCourseGroupCount: 0,
    promotion2Count: 0,
    seminarCount: 0,
  };

  const ms: Partner = {
      pkid: 1, name: 'Microsoft', appKey: 'ms', nameOnPartnerMenu: 'Microsoft 微軟', nameOnCourseDetailPage: '微軟',
      displayOrder: 2001, imageFilename: 'ms.png', ...unused, courseCount: 243,
  };
  const pcb: Partner = {
      pkid: 129, name: 'PCB', appKey: 'PCB', nameOnPartnerMenu: 'PCB 電路板', nameOnCourseDetailPage: 'PCB',
      displayOrder: 1, imageFilename: null, ...unused,
  };
  const sgs: Partner = {
      pkid: 7, name: 'SGS', appKey: 'SGS', nameOnPartnerMenu: 'SGS', nameOnCourseDetailPage: 'SGS',
      displayOrder: 9999, imageFilename: 'SGS.svg', ...unused, seminarCount: 3,
  };
  // p-table sorts [value] in place, so tests reference rows by name, not index.
  const partners: Partner[] = [ms, pcb, sgs];

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(PartnerList);
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
    service = jasmine.createSpyObj<PartnerService>('PartnerService', ['query', 'delete']);
    service.query.and.callFake(() => of([...partners]));
    service.delete.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [PartnerList],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        ConfirmationService,
        MessageService,
        { provide: PartnerService, useValue: service },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => sessionStorage.clear());

  it('loads with empty filters and renders a row per partner', async () => {
    await create();
    expect(service.query).toHaveBeenCalledOnceWith({ keyword: null });

    const rows = fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;
    expect(rows.length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Microsoft 微軟');
    expect(fixture.nativeElement.textContent).toContain('243');
  });

  it('defaults to sorting by displayOrder ascending, 20 rows per page', async () => {
    await create();
    expect(component.sort).toEqual({ field: 'displayOrder', order: 1 });
    expect(component.page).toEqual({ first: 0, rows: 20 });
  });

  it('applyFilters() queries with the trimmed keyword and persists it to session storage', async () => {
    await create();
    service.query.calls.reset();

    component.openFilters();
    component.draft = { keyword: '  ms ' };
    component.applyFilters();

    expect(service.query).toHaveBeenCalledOnceWith({ keyword: 'ms' });
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!)).toEqual({ keyword: 'ms' });
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
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'oracle' }));
    sessionStorage.setItem(SORT_KEY, JSON.stringify({ field: 'name', order: -1 }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 20, rows: 10 }));

    await create();

    expect(service.query).toHaveBeenCalledOnceWith({ keyword: 'oracle' });
    expect(component.sort).toEqual({ field: 'name', order: -1 });
    expect(component.page).toEqual({ first: 20, rows: 10 });
  });

  it('persists sort and paging changes', async () => {
    await create();
    component.onSort({ field: 'name', order: -1 });
    component.onRowsChange(50);
    component.onFirstChange(50);

    expect(JSON.parse(sessionStorage.getItem(SORT_KEY)!)).toEqual({ field: 'name', order: -1 });
    expect(JSON.parse(sessionStorage.getItem(PAGE_KEY)!)).toEqual({ first: 50, rows: 50 });
  });

  it('add() navigates to the new form', async () => {
    await create();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    component.add();
    expect(router.navigate).toHaveBeenCalledWith(['/partners/new']);
  });

  it('confirmDelete() shows pkid + name, deletes after confirmation and reloads', async () => {
    await create();
    const confirm = acceptConfirm();
    service.query.calls.reset();

    component.confirmDelete(pcb);

    expect(confirm.calls.mostRecent().args[0].message).toBe('確定要刪除主代碼 <b>129</b>「PCB」？');
    expect(service.delete).toHaveBeenCalledOnceWith(129);
    expect(service.query).toHaveBeenCalledTimes(1);
  });

  it('treats any child count (including seminars) as in use and skips delete', async () => {
    await create();
    const confirm = acceptConfirm();

    expect(component.inUse(ms)).toBeTrue();
    expect(component.inUse(sgs)).toBeTrue();
    expect(component.inUse(pcb)).toBeFalse();
    component.confirmDelete(sgs);

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

    component.confirmDelete(pcb);

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
