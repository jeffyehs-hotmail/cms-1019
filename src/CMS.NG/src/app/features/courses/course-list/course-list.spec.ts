import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { LookupService } from '../../../core/services/lookup.service';
import { Course } from '../course.model';
import { CourseService } from '../course.service';
import { CourseList, FILTERS_KEY, PAGE_KEY, SORT_KEY } from './course-list';

describe('CourseList', () => {
  let fixture: ComponentFixture<CourseList>;
  let component: CourseList;
  let service: jasmine.SpyObj<CourseService>;
  let lookups: jasmine.SpyObj<LookupService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  const base: Course = {
    pkid: 0, title: '', officialTitle: null, courseId: '', prodCourseId: '', friendlyUrl: '', displayOrder: 0,
    partnerPkid: 1, partnerName: 'Microsoft', courseGroupPkid: null, courseGroupDescription: null,
    publishStatusPkid: 2, publishStatusDescription: '上架中', scheduleOn: '2026-01-01', scheduleOff: '2027-12-31',
    hour: 0, listPrice: 0, learningCredit: 0, canRepeat: false, material: null, objective: null, target: null,
    prerequisites: null, outline: null, towardCertOrExam: null, note: null, otherInfo: null,
    courseFaqCount: 0, courseRelatedLinkCount: 0, hotCourseCount: 0, certifications: [], jobCategories: [],
  };
  const az: Course = {
    ...base, pkid: 10, courseId: 'AZ104', prodCourseId: 'AZ-104', title: 'Azure 管理', displayOrder: 1,
    courseGroupPkid: 46, courseGroupDescription: 'Azure', hour: 32, listPrice: 28000, learningCredit: 4.5,
    canRepeat: true,
  };
  const ccna: Course = {
    ...base, pkid: 42, courseId: 'CCNA', prodCourseId: 'CCNA', title: 'CCNA 網路', displayOrder: 2,
    partnerPkid: 3, partnerName: 'Cisco', courseRelatedLinkCount: 2,
  };
  // p-table sorts [value] in place, so tests reference rows by name, not index.
  const courses: Course[] = [az, ccna];

  async function create(params: Record<string, string> = {}): Promise<void> {
    fixture = TestBed.createComponent(CourseList);
    component = fixture.componentInstance;
    for (const [k, v] of Object.entries(params)) fixture.componentRef.setInput(k, v);
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
    service = jasmine.createSpyObj<CourseService>('CourseService', ['query', 'delete']);
    service.query.and.callFake(() => of([...courses]));
    service.delete.and.returnValue(of(undefined));
    lookups = jasmine.createSpyObj<LookupService>('LookupService', [
      'getPartners',
      'getCourseGroups',
      'getPublishStatuses',
    ]);
    lookups.getPartners.and.returnValue(of([{ pkid: 1, name: 'Microsoft' }]));
    lookups.getCourseGroups.and.returnValue(of([{ pkid: 46, description: 'Azure' }]));
    lookups.getPublishStatuses.and.returnValue(of([{ pkid: 2, description: '上架中' }]));

    await TestBed.configureTestingModule({
      imports: [CourseList],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        ConfirmationService,
        MessageService,
        { provide: CourseService, useValue: service },
        { provide: LookupService, useValue: lookups },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => sessionStorage.clear());

  it('loads with empty filters and renders a row per course with FK labels', async () => {
    await create();

    expect(service.query).toHaveBeenCalledWith(jasmine.objectContaining({ keyword: null, partnerPkid: null }));
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    const text = fixture.nativeElement.querySelector('tbody').textContent as string;
    expect(text).toContain('AZ104');
    expect(text).toContain('Cisco');
    expect(text).toContain('Azure');
    expect(text).toContain('上架中');
    expect(text).toContain('2027/12/31');
    expect(text).toContain('28,000');
    expect(text).toContain('4.5');
  });

  it('defaults to displayOrder ASC and 20 rows', async () => {
    await create();
    expect(component.sort).toEqual({ field: 'displayOrder', order: 1 });
    expect(component.page).toEqual({ first: 0, rows: 20 });
  });

  it('does not load lookups until the drawer is opened, then loads them once', async () => {
    await create();
    expect(lookups.getPartners).not.toHaveBeenCalled();

    component.openFilters();
    component.openFilters();

    expect(lookups.getPartners).toHaveBeenCalledTimes(1);
    expect(component.partners().length).toBe(1);
  });

  it('applies filters (dates as local ISO), persists them and resets paging', async () => {
    await create();
    component.onFirstChange(40);
    component.openFilters();
    component.draft.keyword = '  az ';
    component.draft.partnerPkid = 1;
    component.draft.scheduleOnFrom = new Date(2026, 0, 1);
    component.draft.scheduleOffTo = new Date(2027, 11, 31);
    component.draft.canRepeat = false;
    component.applyFilters();

    const expected = jasmine.objectContaining({
      keyword: 'az',
      partnerPkid: 1,
      scheduleOnFrom: '2026-01-01',
      scheduleOffTo: '2027-12-31',
      canRepeat: false,
    });
    expect(service.query).toHaveBeenCalledWith(expected);
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!)).toEqual(expected);
    expect(component.page.first).toBe(0);
    expect(component.activeFilterCount()).toBe(5);
  });

  it('restores saved filters, sort and page from session storage', async () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'cc', scheduleOnFrom: '2026-03-09' }));
    sessionStorage.setItem(SORT_KEY, JSON.stringify({ field: 'title', order: -1 }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 20, rows: 50 }));

    await create();

    expect(service.query).toHaveBeenCalledWith(jasmine.objectContaining({ keyword: 'cc', scheduleOnFrom: '2026-03-09' }));
    expect(component.sort).toEqual({ field: 'title', order: -1 });
    expect(component.page).toEqual({ first: 20, rows: 50 });
    component.openFilters();
    expect(component.draft.scheduleOnFrom?.getDate()).toBe(9);
  });

  it('an incoming partnerPkid query param replaces saved filters', async () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'cc', canRepeat: true }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 20, rows: 50 }));

    await create({ partnerPkid: '3' });

    const call = service.query.calls.mostRecent().args[0];
    expect(call.partnerPkid).toBe(3);
    expect(call.keyword).toBeNull();
    expect(call.canRepeat).toBeNull();
    expect(component.page).toEqual({ first: 0, rows: 50 });
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).partnerPkid).toBe(3);
  });

  it('ignores a malformed query param', async () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'cc' }));
    await create({ courseGroupPkid: 'abc' });
    expect(service.query).toHaveBeenCalledWith(jasmine.objectContaining({ keyword: 'cc' }));
  });

  it('clearFilters resets everything', async () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'cc', publishStatusPkid: 2 }));
    await create();
    component.clearFilters();
    expect(component.activeFilterCount()).toBe(0);
  });

  it('persists sort and rows changes', async () => {
    await create();
    component.onSort({ field: 'listPrice', order: -1 });
    component.onRowsChange(50);
    expect(JSON.parse(sessionStorage.getItem(SORT_KEY)!)).toEqual({ field: 'listPrice', order: -1 });
    expect(JSON.parse(sessionStorage.getItem(PAGE_KEY)!).rows).toBe(50);
  });

  it('confirms delete with pkid, CourseId and title, then reloads', async () => {
    await create();
    const confirm = acceptConfirm();
    service.query.calls.reset();

    component.confirmDelete(az);

    expect(confirm.calls.mostRecent().args[0].message).toContain('<b>10</b>「AZ104 Azure 管理」');
    expect(service.delete).toHaveBeenCalledWith(10);
    expect(service.query).toHaveBeenCalled();
  });

  it('does not confirm delete for an in-use course and disables its button', async () => {
    await create();
    const confirm = spyOn(confirmation, 'confirm');

    component.confirmDelete(ccna);

    expect(confirm).not.toHaveBeenCalled();
    expect(component.inUse(ccna)).toBeTrue();
    expect(component.inUse(az)).toBeFalse();
    const disabled = fixture.nativeElement.querySelectorAll('button[aria-label="刪除"]:disabled');
    expect(disabled.length).toBe(1);
  });

  it('shows the 409 message from the API', async () => {
    await create();
    acceptConfirm();
    const add = spyOn(messages, 'add');
    service.delete.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: '使用中，無法刪除' } })),
    );

    component.confirmDelete(az);

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '使用中，無法刪除' }));
  });

  it('navigates to /courses/new on add', async () => {
    await create();
    const nav = spyOn(TestBed.inject(Router), 'navigate');
    component.add();
    expect(nav).toHaveBeenCalledWith(['/courses/new']);
  });
});
