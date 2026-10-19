import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { Course } from '../course.model';
import { CourseService } from '../course.service';
import { CourseDetail } from './course-detail';

describe('CourseDetail', () => {
  let fixture: ComponentFixture<CourseDetail>;
  let service: jasmine.SpyObj<CourseService>;
  let confirmation: ConfirmationService;

  const course: Course = {
    pkid: 42, title: 'CCNP 課程', officialTitle: null, courseId: 'CCNP', prodCourseId: 'CCNP-ENCOR',
    friendlyUrl: 'ccnp', displayOrder: 3, partnerPkid: 4, partnerName: 'Cisco', courseGroupPkid: null,
    courseGroupDescription: null, publishStatusPkid: 2, publishStatusDescription: '上架中',
    scheduleOn: '2026-01-01', scheduleOff: '2027-12-31', hour: 40, listPrice: 30000, learningCredit: 5,
    canRepeat: true, material: null, objective: '學會路由', target: null, prerequisites: null,
    outline: '第一章\n第二章', towardCertOrExam: null, note: null, otherInfo: null,
    courseFaqCount: 0, courseRelatedLinkCount: 0, hotCourseCount: 0,
    certifications: [{ pkid: 7, title: 'Cisco Certified CCNP', partnerName: 'Cisco' }],
    jobCategories: [
      { pkid: 1, description: '網路系統工程' },
      { pkid: 15, description: '網路通訊' },
    ],
  };

  function create(): HTMLElement {
    fixture = TestBed.createComponent(CourseDetail);
    fixture.componentRef.setInput('id', '42');
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const text = (el: HTMLElement, f: string) => el.querySelector(`[data-field="${f}"]`)?.textContent?.trim();

  beforeEach(async () => {
    service = jasmine.createSpyObj<CourseService>('CourseService', ['getById', 'delete']);
    service.getById.and.returnValue(of(course));
    service.delete.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [CourseDetail],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        ConfirmationService,
        MessageService,
        { provide: CourseService, useValue: service },
      ],
    }).compileComponents();
    confirmation = TestBed.inject(ConfirmationService);
  });

  it('renders the course fields', () => {
    const el = create();

    expect(service.getById).toHaveBeenCalledWith(42);
    expect(text(el, 'courseId')).toBe('CCNP');
    expect(text(el, 'officialTitle')).toBe('—');
    expect(text(el, 'courseGroup')).toBe('—');
    expect(text(el, 'scheduleOff')).toBe('2027/12/31');
    expect(text(el, 'listPrice')).toBe('30,000');
    expect(text(el, 'learningCredit')).toBe('5.0');
    expect(text(el, 'canRepeat')).toBe('是');
    expect(text(el, 'outline')).toBe('第一章\n第二章');
    expect(text(el, 'material')).toBe('—');
  });

  it('links FK labels to the parent detail pages', () => {
    const el = create();

    expect(el.querySelector('[data-field="partner"] a')!.getAttribute('href')).toBe('/partners/4');
    expect(el.querySelector('[data-field="publishStatus"] a')!.getAttribute('href')).toBe('/publish-statuses/2');
    expect(el.querySelector('[data-field="courseGroup"] a')).toBeNull();
  });

  it('shows n-n items as chips', () => {
    const el = create();

    expect(el.querySelectorAll('[data-field="certifications"] p-chip').length).toBe(1);
    expect(text(el, 'certifications')).toContain('Cisco ‧ Cisco Certified CCNP');
    expect(el.querySelectorAll('[data-field="jobCategories"] p-chip').length).toBe(2);
  });

  it('shows not-found on 404', () => {
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const el = create();

    expect(el.textContent).toContain('找不到此課程資料');
    expect(el.querySelector('[data-field="courseId"]')).toBeNull();
  });

  it('deletes after confirmation and returns to the list', () => {
    create();
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.accept?.();
      return confirmation;
    });
    const nav = spyOn(TestBed.inject(Router), 'navigate');

    fixture.componentInstance.confirmDelete(course);

    expect(service.delete).toHaveBeenCalledWith(42);
    expect(nav).toHaveBeenCalledWith(['/courses']);
  });

  it('refuses to delete an in-use course', () => {
    create();
    const confirm = spyOn(confirmation, 'confirm');

    fixture.componentInstance.confirmDelete({ ...course, hotCourseCount: 1 });

    expect(confirm).not.toHaveBeenCalled();
  });
});
