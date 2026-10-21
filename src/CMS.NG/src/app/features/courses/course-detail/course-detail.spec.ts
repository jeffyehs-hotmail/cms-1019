import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { Course } from '../course.model';
import { CourseService } from '../course.service';
import { QrCode } from '../../../core/components/qr-code/qr-code';
import { QrCodeRenderer } from '../../../core/components/qr-code/qr-code-renderer';
import { CourseDetail } from './course-detail';

describe('CourseDetail', () => {
  let fixture: ComponentFixture<CourseDetail>;
  let service: jasmine.SpyObj<CourseService>;
  let confirmation: ConfirmationService;

  const course: Course = {
    pkid: 42, title: 'CCNP 課程', officialTitle: null, courseId: 'CCNP', prodCourseId: 'CCNP-ENCOR',
    friendlyUrl: 'ccnp', displayOrder: 3, partnerPkid: 4, partnerName: 'Cisco', courseGroupPkid: null,
    courseGroupDescription: null, publishStatusPkid: 2, publishStatusDescription: '上架中',
    publishStatusIsPublished: true, scheduleOn: '2026-01-01', scheduleOff: '2027-12-31', hour: 40, listPrice: 30000, learningCredit: 5,
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

  /** Lets the real (timer-free) QR render promises settle while the mock clock is installed. */
  async function flush(): Promise<void> {
    for (let i = 0; i < 10; i++) await Promise.resolve();
    fixture.detectChanges();
  }

  // Fixed "today" so whether the brochure draws its QR doesn't depend on the calendar (eng re-run D21).
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 21));
  });
  afterEach(() => jasmine.clock().uninstall());

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

  describe('QR code (基本資料)', () => {
    // The hidden brochure has its own QR, so queries are scoped to the 基本資料 card (D21).
    const qr = () =>
      fixture.debugElement.query((d) => d.componentInstance instanceof QrCode && !!d.nativeElement.closest('.page-card'));

    it('encodes the public course URL built from pkid and CourseId', () => {
      const render = spyOn(TestBed.inject(QrCodeRenderer), 'render').and.resolveTo();
      const el = create();

      expect(render).toHaveBeenCalledTimes(2); // 基本資料 + the live course's brochure
      expect(render.calls.first().args[1]).toBe('https://www.uuu.com.tw/Course/Show/42/CCNP');
      expect((qr().componentInstance as QrCode).text()).toBe('https://www.uuu.com.tw/Course/Show/42/CCNP');
      expect(el.querySelector('.page-card .qr-field')).not.toBeNull();
    });

    it('shows CourseId as the QR code title', () => {
      spyOn(TestBed.inject(QrCodeRenderer), 'render').and.resolveTo();
      const el = create();
      expect(el.querySelector('.page-card [data-qr-title]')?.textContent?.trim()).toBe('CCNP');
      expect((qr().componentInstance as QrCode).title()).toBe('CCNP');
    });

    it('download produces a PNG image named after the CourseId', async () => {
      create();
      await flush(); // real render finishes
      const click = spyOn(HTMLAnchorElement.prototype, 'click');

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.page-card [data-qr-download] button')!.click();

      const a = click.calls.mostRecent().object as HTMLAnchorElement;
      expect(a.download).toBe('CCNP.png');
      expect(a.href).toContain('data:image/png;base64,iVBORw0KGgo');
    });
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

  describe('列印PDF', () => {
    const printButton = () =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-print] button')!;
    const banner = () => (fixture.nativeElement as HTMLElement).querySelector('[data-qr-banner]')?.textContent?.trim();
    let originalTitle: string;

    beforeEach(() => (originalTitle = document.title));
    afterEach(() => {
      document.title = originalTitle;
      document.documentElement.style.removeProperty('--brochure-footer');
    });

    it('is disabled while the brochure QR draws, then prints', async () => {
      let resolve!: () => void;
      spyOn(TestBed.inject(QrCodeRenderer), 'render').and.returnValue(new Promise<void>((r) => (resolve = r)));
      const print = spyOn(window, 'print');
      create();
      expect(printButton().disabled).toBeTrue();

      resolve();
      await flush();
      expect(printButton().disabled).toBeFalse();
      printButton().click();
      expect(print).toHaveBeenCalledTimes(1);
    });

    it('beforeprint (button or Ctrl+P) sets the PDF title and footer; afterprint restores them', async () => {
      spyOn(TestBed.inject(QrCodeRenderer), 'render').and.resolveTo();
      service.getById.and.returnValue(of({ ...course, courseId: 'CC/NP', title: '路由 "進階"' }));
      create();
      await flush();
      document.title = 'CMS';

      window.dispatchEvent(new Event('beforeprint'));
      expect(document.title).toBe('CC_NP');
      expect(document.documentElement.style.getPropertyValue('--brochure-footer'))
        .toBe('"恆逸教育訓練中心 · 路由 \\"進階\\" · 2026/10/21"');

      window.dispatchEvent(new Event('afterprint'));
      expect(document.title).toBe('CMS');
      expect(document.documentElement.style.getPropertyValue('--brochure-footer')).toBe('');
    });

    it('warns after printing if the QR was not drawn yet', () => {
      spyOn(TestBed.inject(QrCodeRenderer), 'render').and.returnValue(new Promise<void>(() => {}));
      const toast = spyOn(TestBed.inject(MessageService), 'add');
      spyOn(console, 'warn');
      create();

      window.dispatchEvent(new Event('beforeprint'));
      window.dispatchEvent(new Event('afterprint'));

      expect(toast).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn' }));
      expect(console.warn).toHaveBeenCalled();
    });

    it('stops listening once the page is destroyed', () => {
      spyOn(TestBed.inject(QrCodeRenderer), 'render').and.resolveTo();
      create();
      fixture.destroy();
      document.title = 'CMS';

      window.dispatchEvent(new Event('beforeprint'));

      expect(document.title).toBe('CMS');
    });

    it('prints a wait line instead of a blank page before the course loads', () => {
      service.getById.and.returnValue(NEVER);
      const el = create();
      expect(el.querySelector('.print-only')?.textContent).toContain('請於頁面載入完成後再列印');
    });

    const reasons: [string, Partial<Course>, string][] = [
      ['unpublished', { publishStatusIsPublished: false }, '此課程未發布。如需 QR Code，請將發布狀態改為上架'],
      ['expired', { scheduleOff: '2026-10-20' }, '此課程已下架。如需 QR Code，請調整上架／下架日期'],
      ['not started', { scheduleOn: '2026-10-22' }, '此課程尚未上架。如需 QR Code，請調整上架／下架日期'],
    ];
    for (const [name, overrides, text] of reasons) {
      it(`banner names the printout and the fix when the course is ${name}`, () => {
        service.getById.and.returnValue(of({ ...course, ...overrides }));
        create();
        expect(banner()).toBe(`列印PDF 將不含 QR Code：${text}`);
        expect(printButton().disabled).toBeFalse(); // nothing to wait for
      });
    }

    it('banner reports a failed QR draw and printing stays possible', async () => {
      spyOn(TestBed.inject(QrCodeRenderer), 'render').and.rejectWith(new Error('overflow'));
      spyOn(console, 'error');
      create();
      await flush();

      expect(banner()).toContain('QR Code 產生失敗');
      expect(printButton().disabled).toBeFalse();
    });

    it('shows no banner for a live course', async () => {
      spyOn(TestBed.inject(QrCodeRenderer), 'render').and.resolveTo();
      create();
      await flush();
      expect(banner()).toBeUndefined();
    });
  });
});
