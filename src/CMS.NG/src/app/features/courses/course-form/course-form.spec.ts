import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { LookupService } from '../../../core/services/lookup.service';
import { Course, CourseRequest } from '../course.model';
import { CourseService } from '../course.service';
import { CourseForm } from './course-form';

describe('CourseForm', () => {
  let fixture: ComponentFixture<CourseForm>;
  let component: CourseForm;
  let service: jasmine.SpyObj<CourseService>;
  let lookups: jasmine.SpyObj<LookupService>;
  let router: Router;
  let messages: MessageService;

  const course: Course = {
    pkid: 42, title: 'CCNP 課程', officialTitle: null, courseId: 'CCNP', prodCourseId: 'CCNP-ENCOR',
    friendlyUrl: 'ccnp', displayOrder: 3, partnerPkid: 4, partnerName: 'Cisco', courseGroupPkid: 46,
    courseGroupDescription: 'Cisco', publishStatusPkid: 2, publishStatusDescription: '上架中', publishStatusIsPublished: true,
    scheduleOn: '2026-01-01', scheduleOff: '2027-12-31', hour: 40, listPrice: 30000, learningCredit: 5,
    canRepeat: true, material: null, objective: '學會路由', target: null, prerequisites: null,
    outline: '第一章', towardCertOrExam: null, note: null, otherInfo: null,
    courseFaqCount: 0, courseRelatedLinkCount: 0, hotCourseCount: 0,
    certifications: [{ pkid: 7, title: 'CCNP', partnerName: 'Cisco' }],
    jobCategories: [{ pkid: 1, description: '網路系統工程' }],
  };

  function create(id?: string): void {
    fixture = TestBed.createComponent(CourseForm);
    component = fixture.componentInstance;
    if (id) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  }

  function fillValid(): void {
    component.form.patchValue({
      courseId: ' AZ900 ',
      prodCourseId: 'AZ-900',
      title: ' Azure 基礎 ',
      officialTitle: '  ',
      friendlyUrl: 'az-900',
      partnerPkid: 1,
      publishStatusPkid: 1,
      scheduleOn: new Date(2026, 0, 1),
      scheduleOff: new Date(2027, 11, 31),
      hour: 7,
      listPrice: 9000,
      learningCredit: 1.5,
      certificationPkids: [7],
      outline: ' 大綱 ',
    });
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj<CourseService>('CourseService', ['getById', 'create', 'update']);
    service.getById.and.returnValue(of(course));
    service.create.and.callFake((req) => of({ ...course, ...req, pkid: 3400 } as unknown as Course));
    service.update.and.callFake((req) => of({ ...course, ...req } as unknown as Course));
    lookups = jasmine.createSpyObj<LookupService>('LookupService', [
      'getPartners',
      'getCourseGroups',
      'getPublishStatuses',
      'getCertifications',
      'getJobCategories',
    ]);
    lookups.getPartners.and.returnValue(of([{ pkid: 1, name: 'Microsoft' }, { pkid: 4, name: 'Cisco' }]));
    lookups.getCourseGroups.and.returnValue(of([{ pkid: 46, description: 'Cisco' }]));
    lookups.getPublishStatuses.and.returnValue(of([{ pkid: 1, description: '草稿' }, { pkid: 2, description: '上架中' }]));
    lookups.getCertifications.and.returnValue(of([{ pkid: 7, title: 'CCNP', partnerName: 'Cisco' }]));
    lookups.getJobCategories.and.returnValue(of([{ pkid: 1, description: '網路系統工程' }]));

    await TestBed.configureTestingModule({
      imports: [CourseForm],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: CourseService, useValue: service },
        { provide: LookupService, useValue: lookups },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    messages = TestBed.inject(MessageService);
    spyOn(router, 'navigate');
  });

  it('new: loads lookups, not the course, and defaults the dates', () => {
    create();

    expect(service.getById).not.toHaveBeenCalled();
    expect(component.partners().length).toBe(2);
    expect(component.certifications()[0].label).toBe('Cisco ‧ CCNP');
    const { scheduleOn, scheduleOff } = component.form.getRawValue();
    const today = new Date();
    expect(scheduleOn!.getDate()).toBe(today.getDate());
    expect(scheduleOff!.getFullYear()).toBe(today.getFullYear() + 1);
    expect(scheduleOff!.getMonth()).toBe(11);
    expect(scheduleOff!.getDate()).toBe(31);
  });

  for (const mode of ['new', 'edit'] as const) {
    it(`${mode}: the action toolbar is pinned (sticky) above the form with 儲存 and 取消`, () => {
      create(mode === 'edit' ? '42' : undefined);

      const toolbar = fixture.nativeElement.querySelector('form > .page-header') as HTMLElement;
      expect(toolbar).withContext('toolbar').not.toBeNull();
      expect(toolbar.classList).toContain('sticky-toolbar');
      const style = getComputedStyle(toolbar);
      expect(style.position).toBe('sticky');
      expect(style.top).toBe('0px');
      expect(Number(style.zIndex)).toBeGreaterThan(0);
      // The toolbar precedes the form body in DOM order, so it stays on top of the cards.
      expect(toolbar.nextElementSibling?.classList).toContain('page-card');

      const labels = Array.from(toolbar.querySelectorAll('button')).map((b) => b.textContent?.trim());
      expect(labels).toContain('儲存');
      expect(labels).toContain('取消');
      expect(toolbar.querySelector('button[type="submit"]')?.textContent).toContain('儲存');
      expect(toolbar.querySelector('h1')?.textContent).toBe(mode === 'edit' ? '編輯課程' : '新增課程');
    });
  }

  it('enforces required fields', () => {
    create();
    component.form.patchValue({ scheduleOn: null, scheduleOff: null });

    component.save();

    expect(service.create).not.toHaveBeenCalled();
    for (const name of [
      'courseId',
      'prodCourseId',
      'title',
      'friendlyUrl',
      'partnerPkid',
      'publishStatusPkid',
      'scheduleOn',
      'scheduleOff',
    ] as const) {
      expect(component.form.controls[name].hasError('required')).withContext(name).toBeTrue();
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('small.error').length).toBeGreaterThan(0);
  });

  it('rejects non-ASCII CourseId and over-long text', () => {
    create();
    fillValid();
    component.form.patchValue({ courseId: '課程', material: 'x'.repeat(501) });

    expect(component.form.controls.courseId.hasError('pattern')).toBeTrue();
    expect(component.form.controls.material.hasError('maxlength')).toBeTrue();
    expect(component.errorText('courseId', '簡介代碼', 50)).toBe('僅限英數字元');
  });

  it('rejects ScheduleOff before ScheduleOn', () => {
    create();
    fillValid();
    component.form.patchValue({ scheduleOff: new Date(2025, 11, 31) });
    component.form.controls.scheduleOff.markAsTouched();
    fixture.detectChanges();

    expect(component.form.hasError('scheduleRange')).toBeTrue();
    expect(fixture.nativeElement.querySelector('[data-error="scheduleRange"]')).not.toBeNull();
    component.save();
    expect(service.create).not.toHaveBeenCalled();

    component.form.patchValue({ scheduleOff: new Date(2026, 0, 1) }); // same day is fine
    expect(component.form.hasError('scheduleRange')).toBeFalse();
  });

  it('new: creates with trimmed values, ISO dates and n-n ids, then navigates', () => {
    create();
    fillValid();

    component.save();

    const req = service.create.calls.mostRecent().args[0] as CourseRequest;
    expect(req.pkid).toBeUndefined();
    expect(req.courseId).toBe('AZ900');
    expect(req.title).toBe('Azure 基礎');
    expect(req.officialTitle).toBeNull();
    expect(req.courseGroupPkid).toBeNull();
    expect(req.scheduleOn).toBe('2026-01-01');
    expect(req.scheduleOff).toBe('2027-12-31');
    expect(req.learningCredit).toBe(1.5);
    expect(req.certificationPkids).toEqual([7]);
    expect(req.jobCategoryPkids).toEqual([]);
    expect(req.outline).toBe('大綱');
    expect(req.material).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/courses', 3400]);
  });

  it('edit: loads the course and patches the form', () => {
    create('42');

    expect(service.getById).toHaveBeenCalledWith(42);
    const v = component.form.getRawValue();
    expect(v.courseId).toBe('CCNP');
    expect(v.scheduleOn!.getFullYear()).toBe(2026);
    expect(v.scheduleOff!.getDate()).toBe(31);
    expect(v.courseGroupPkid).toBe(46);
    expect(v.certificationPkids).toEqual([7]);
    expect(v.jobCategoryPkids).toEqual([1]);
    expect(v.officialTitle).toBe('');
    expect(v.objective).toBe('學會路由');
  });

  it('edit: updates with pkid in the body', () => {
    create('42');
    component.form.patchValue({ title: 'CCNP 進階', courseGroupPkid: null });

    component.save();

    const req = service.update.calls.mostRecent().args[0] as CourseRequest;
    expect(req.pkid).toBe(42);
    expect(req.title).toBe('CCNP 進階');
    expect(req.courseGroupPkid).toBeNull();
    expect(req.scheduleOff).toBe('2027-12-31');
    expect(router.navigate).toHaveBeenCalledWith(['/courses', 42]);
  });

  it('shows the 409 message (duplicate CourseId) as a toast', () => {
    create();
    fillValid();
    const add = spyOn(messages, 'add');
    service.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: "簡介代碼 'AZ900' 已存在" } })),
    );

    component.save();

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: "簡介代碼 'AZ900' 已存在" }));
    expect(component.saving()).toBeFalse();
  });

  it('shows the 400 message from the API as a toast', () => {
    create();
    fillValid();
    const add = spyOn(messages, 'add');
    service.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { message: '原廠 1 不存在' } })),
    );

    component.save();

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ detail: '原廠 1 不存在' }));
  });

  it('cancel goes back to the list (new) or detail (edit)', () => {
    create();
    component.cancel();
    expect(router.navigate).toHaveBeenCalledWith(['/courses']);
  });
});
