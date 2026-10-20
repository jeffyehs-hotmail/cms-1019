import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { LookupService } from '../../../core/services/lookup.service';
import { Course, CourseRequest } from '../course.model';
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
  // p-table sorts [value] in place and inline edits mutate rows, so query returns copies and tests reference rows by pkid.
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
    service = jasmine.createSpyObj<CourseService>('CourseService', ['query', 'delete', 'getById', 'update']);
    service.query.and.callFake(() => of(courses.map((c) => ({ ...c }))));
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
  describe('in-place editing', () => {
    // Column order in the list table.
    const COL = {
      pkid: 0, displayOrder: 1, courseId: 2, prodCourseId: 3, title: 4, partner: 5, courseGroup: 6,
      status: 7, scheduleOn: 8, scheduleOff: 9, hour: 10, listPrice: 11, learningCredit: 12, canRepeat: 13,
    };
    const full: Course = {
      ...az, outline: 'long outline', note: 'a note',
      certifications: [{ pkid: 7, title: 'AZ-104', partnerName: 'Microsoft' }],
      jobCategories: [{ pkid: 2, description: 'IT' }],
    };

    /** The live row object (query returns copies, so edits never touch the shared fixtures). */
    function row(pkid: number): Course {
      return component.courses().find((c) => c.pkid === pkid)!;
    }

    function cell(pkid: number, col: number): HTMLTableCellElement {
      const rows = Array.from(fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>);
      const row = rows.find((r) => r.cells[0].textContent?.trim() === String(pkid))!;
      return row.cells[col];
    }

    function fire(el: Element, type: string): void {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true }));
    }

    async function settle(): Promise<void> {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    async function openCell(pkid: number, col: number): Promise<HTMLTableCellElement> {
      fire(cell(pkid, col), 'dblclick');
      await settle();
      return cell(pkid, col);
    }

    /** Type into the open text editor and blur it (the save trigger). */
    async function typeAndBlur(td: HTMLTableCellElement, value: string): Promise<void> {
      const input = td.querySelector('input') as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      input.dispatchEvent(new Event('blur'));
      await settle();
    }

    beforeEach(async () => {
      service.getById.and.callFake(() => of({ ...full }));
      service.update.and.callFake((r: CourseRequest) => of({ ...full, ...r } as Course));
      await create();
    });

    it('double-click opens an editor; single click does not', async () => {
      const td = cell(10, COL.title);
      fire(td, 'click');
      await settle();
      expect(component.editing()).toBeNull();
      expect(td.querySelector('input')).toBeNull();

      fire(td, 'dblclick');
      await settle();
      expect(component.editing()).toEqual({ pkid: 10, field: 'title' });
      const input = cell(10, COL.title).querySelector('input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('Azure 管理');
      expect(cell(10, COL.title).classList).toContain('cell-editing');
    });

    it('主代碼, 原廠 and 課程群組 cannot be edited', async () => {
      for (const col of [COL.pkid, COL.partner, COL.courseGroup]) {
        const td = cell(10, col);
        expect(td.classList).not.toContain('editable');
        fire(td, 'dblclick');
        await settle();
        expect(component.editing()).toBeNull();
        expect(td.querySelector('input, p-select')).toBeNull();
      }
      // Every other column is editable.
      const editable = Array.from(cell(10, COL.pkid).parentElement!.querySelectorAll('td.editable'));
      expect(editable.length).toBe(11);
    });

    it('uses the input type that matches the column', async () => {
      expect((await openCell(10, COL.hour)).querySelector('p-inputnumber')).not.toBeNull();
      component.cancelEdit();
      expect((await openCell(10, COL.scheduleOn)).querySelector('p-datepicker')).not.toBeNull();
      component.cancelEdit();
      expect((await openCell(10, COL.status)).querySelector('p-select')).not.toBeNull();
      expect(lookups.getPublishStatuses).toHaveBeenCalledTimes(1);
      component.cancelEdit();
      expect((await openCell(10, COL.canRepeat)).querySelector('p-checkbox')).not.toBeNull();
    });

    it('blur fetches the full record and PUTs it with only the edited field changed', async () => {
      const td = await openCell(10, COL.title);
      const add = spyOn(messages, 'add');

      await typeAndBlur(td, ' Azure 進階 ');

      expect(service.getById).toHaveBeenCalledWith(10);
      expect(service.update).toHaveBeenCalledTimes(1);
      const req = service.update.calls.mostRecent().args[0];
      expect(req).toEqual(jasmine.objectContaining({
        pkid: 10, title: 'Azure 進階', courseId: 'AZ104', outline: 'long outline', note: 'a note',
        certificationPkids: [7], jobCategoryPkids: [2],
      }));
      expect(component.editing()).toBeNull();
      expect(cell(10, COL.title).textContent?.trim()).toBe('Azure 進階');
      expect(component.savingPkids().size).toBe(0);
      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
    });

    it('an unchanged value closes the cell without calling the API', async () => {
      const td = await openCell(10, COL.title);
      await typeAndBlur(td, 'Azure 管理');
      expect(service.getById).not.toHaveBeenCalled();
      expect(service.update).not.toHaveBeenCalled();
      expect(component.editing()).toBeNull();
    });

    it('a required field cannot be cleared: inline error, cell stays open, no save', async () => {
      const td = await openCell(10, COL.title);
      await typeAndBlur(td, '   ');

      expect(service.update).not.toHaveBeenCalled();
      expect(component.editing()).toEqual({ pkid: 10, field: 'title' });
      const err = cell(10, COL.title).querySelector('.cell-error');
      expect(err?.textContent).toContain('請輸入課程名稱');
      expect(cell(10, COL.title).querySelector('input')).not.toBeNull();
      expect(row(10).title).toBe('Azure 管理');
    });

    it('a failed validation also blocks double-clicking into another cell', async () => {
      const td = await openCell(10, COL.title);
      await typeAndBlur(td, '');
      fire(cell(42, COL.title), 'dblclick');
      await settle();
      expect(component.editing()).toEqual({ pkid: 10, field: 'title' });
      expect(cell(42, COL.title).querySelector('input')).toBeNull();
    });

    it('numeric fields must be non-negative numbers', async () => {
      await openCell(10, COL.hour);
      component.editValue = -1;
      component.commit();
      await settle();
      expect(component.editError()).toBe('時數不可為負數');
      expect(cell(10, COL.hour).querySelector('.cell-error')?.textContent).toContain('不可為負數');
      expect(component.editing()).toEqual({ pkid: 10, field: 'hour' });

      component.editValue = null;
      component.commit();
      expect(component.editError()).toBe('請輸入時數');

      component.editValue = 40;
      component.commit();
      await settle();
      expect(service.update.calls.mostRecent().args[0].hour).toBe(40);
      expect(component.editing()).toBeNull();
    });

    it('date fields must be valid dates', async () => {
      await openCell(10, COL.scheduleOff);
      component.editValue = '2026/13/99'; // keepInvalid leaves unparsable text in the model
      component.commit();
      await settle();
      expect(component.editError()).toBe('日期格式不正確');
      expect(component.editing()).toEqual({ pkid: 10, field: 'scheduleOff' });
      expect(service.update).not.toHaveBeenCalled();

      component.editValue = new Date(2028, 5, 30);
      component.commit();
      await settle();
      expect(service.update.calls.mostRecent().args[0].scheduleOff).toBe('2028-06-30');
    });

    it('上架日期 must not be after 下架日期', async () => {
      await openCell(10, COL.scheduleOn);
      component.editValue = new Date(2028, 0, 1); // scheduleOff is 2027-12-31
      component.commit();
      expect(component.editError()).toBe('下架日期不可早於上架日期');
      expect(service.update).not.toHaveBeenCalled();
      component.cancelEdit();

      await openCell(10, COL.scheduleOff);
      component.editValue = new Date(2025, 11, 31); // before scheduleOn 2026-01-01
      component.commit();
      expect(component.editError()).toBe('下架日期不可早於上架日期');
      expect(service.update).not.toHaveBeenCalled();
    });

    it('overlay editors ignore the blur caused by opening their panel', async () => {
      await openCell(10, COL.status);
      component.editValue = 3;
      component.onOverlayBlur({ overlayVisible: true });
      expect(component.editing()).not.toBeNull();
      expect(service.update).not.toHaveBeenCalled();

      component.onOverlayBlur({ overlayVisible: false });
      await settle();
      expect(service.update.calls.mostRecent().args[0].publishStatusPkid).toBe(3);
      expect(component.editing()).toBeNull();
    });

    it('reverts the cell and toasts the API message when the save fails', async () => {
      service.update.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { message: "簡介代碼 'CCNA' 已存在" } })),
      );
      const add = spyOn(messages, 'add');
      const td = await openCell(10, COL.courseId);

      await typeAndBlur(td, 'CCNA');

      expect(service.update).toHaveBeenCalled();
      expect(component.editing()).toBeNull();
      expect(row(10).courseId).toBe('AZ104');
      expect(cell(10, COL.courseId).textContent?.trim()).toBe('AZ104');
      expect(component.savingPkids().size).toBe(0);
      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: "簡介代碼 'CCNA' 已存在" }));
    });

    it('reverts with a generic message on a server error', async () => {
      service.update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      const add = spyOn(messages, 'add');
      await openCell(10, COL.hour);
      component.editValue = 99;
      component.commit();
      await settle();

      expect(row(10).hour).toBe(32);
      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '儲存失敗' }));
    });

    it('Escape cancels without saving', async () => {
      const td = await openCell(10, COL.title);
      const input = td.querySelector('input') as HTMLInputElement;
      input.value = 'changed';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();

      expect(component.editing()).toBeNull();
      expect(service.update).not.toHaveBeenCalled();
      expect(row(10).title).toBe('Azure 管理');
      expect(cell(10, COL.title).querySelector('input')).toBeNull();
    });
  });
});
