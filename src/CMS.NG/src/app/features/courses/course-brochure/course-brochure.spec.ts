import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QrCode } from '../../../core/components/qr-code/qr-code';
import { QrCodeRenderer } from '../../../core/components/qr-code/qr-code-renderer';
import { Course } from '../course.model';
import { CourseBrochure } from './course-brochure';

describe('CourseBrochure', () => {
  let fixture: ComponentFixture<CourseBrochure>;
  const TODAY = '2026-10-21';

  const base: Course = {
    pkid: 42, title: 'CCNP 課程', officialTitle: 'Implementing Cisco Enterprise', courseId: 'CCNP',
    prodCourseId: 'CCNP-ENCOR', friendlyUrl: 'ccnp', displayOrder: 3, partnerPkid: 4, partnerName: 'Cisco',
    courseGroupPkid: null, courseGroupDescription: null,
    publishStatusPkid: 2, publishStatusDescription: '上架中', publishStatusIsPublished: true,
    scheduleOn: '2026-01-01', scheduleOff: '2027-12-31', hour: 40, listPrice: 30000, learningCredit: 5,
    canRepeat: true, material: null, objective: '學會路由', target: '網管人員', prerequisites: '  ',
    outline: '第一章\n第二章', towardCertOrExam: null, note: null, otherInfo: null,
    courseFaqCount: 0, courseRelatedLinkCount: 0, hotCourseCount: 0,
    certifications: [
      { pkid: 7, title: 'CCNP Enterprise', partnerName: 'Cisco' },
      { pkid: 8, title: 'ENCOR 350-401', partnerName: 'Cisco' },
    ],
    jobCategories: [],
  };

  function create(overrides: Partial<Course> = {}): HTMLElement {
    fixture = TestBed.createComponent(CourseBrochure);
    fixture.componentRef.setInput('course', { ...base, ...overrides });
    fixture.componentRef.setInput('today', TODAY);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const b = (el: HTMLElement, key: string) => el.querySelector(`[data-b="${key}"]`)?.textContent?.trim();
  const sectionLabels = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('[data-b-section]')).map((s) => s.getAttribute('data-b-section'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CourseBrochure] }).compileComponents();
    spyOn(TestBed.inject(QrCodeRenderer), 'render').and.resolveTo();
  });

  it('renders the title block, a print-variant QR and the URL without scheme', () => {
    const el = create();

    expect(b(el, 'company')).toBe('恆逸教育訓練中心');
    expect(b(el, 'title')).toBe('CCNP 課程');
    expect(b(el, 'officialTitle')).toBe('Implementing Cisco Enterprise');
    const qr = fixture.debugElement.query((d) => d.componentInstance instanceof QrCode).componentInstance as QrCode;
    expect(qr.variant()).toBe('print');
    expect(qr.text()).toBe('https://www.uuu.com.tw/Course/Show/42/CCNP');
    expect(b(el, 'url')).toBe('www.uuu.com.tw/Course/Show/42/CCNP');
  });

  it('prints sections in customer order and skips empty or whitespace-only ones', () => {
    const el = create();
    expect(sectionLabels(el)).toEqual(['課程目標', '適合對象', '課程大綱']);
  });

  it('facts strip shows values only and skips 時數 0', () => {
    expect(b(create(), 'facts')).toBe('Cisco · 40 小時');
    expect(b(create({ hour: 0 }), 'facts')).toBe('Cisco');
  });

  it('prints 認證 as plain text joined by 、, and omits the line when there are none', () => {
    expect(b(create(), 'certifications')).toBe('認證：Cisco ‧ CCNP Enterprise、Cisco ‧ ENCOR 350-401');
    expect(b(create({ certifications: [] }), 'certifications')).toBeUndefined();
  });

  it('omits the facts strip when it has no items', () => {
    expect(b(create({ partnerName: '', hour: 0 }), 'facts')).toBeUndefined();
  });

  it('hides 定價 by default (SHOW_PRICE = false)', () => {
    expect(b(create(), 'price')).toBeUndefined();
  });

  it('shows 定價 when the switch is on (D12)', () => {
    create();
    (fixture.componentInstance as { showPrice: boolean }).showPrice = true;
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(b(fixture.nativeElement, 'price')).toBe('定價：NT$ 30,000');
  });

  it('prints only the 請洽業務 fallback when every long text is empty', () => {
    const el = create({ objective: null, target: '', prerequisites: '  ', outline: null });
    expect(b(el, 'fallback')).toBe('詳細課程內容請洽業務');
    expect(sectionLabels(el)).toEqual([]);
  });

  it('prints the 請洽業務 fallback when no content field has text, still printing notes', () => {
    const el = create({ objective: null, target: null, outline: null, note: '僅備註' });
    expect(b(el, 'fallback')).toBe('詳細課程內容請洽業務');
    expect(sectionLabels(el)).toEqual(['備註']);
  });

  it('has no fallback line when content exists', () => {
    expect(b(create(), 'fallback')).toBeUndefined();
  });

  it('closes with the contact block', () => {
    expect(b(create(), 'contact')).toContain('www.uuu.com.tw');
  });

  it('omits the QR (and is ready) when the course is not live', () => {
    const el = create({ publishStatusIsPublished: false });
    expect(b(el, 'qr')).toBeUndefined();
    expect(fixture.componentInstance.ready()).toBeTrue();
  });

  it('is ready once its QR is drawn', async () => {
    create();
    await fixture.whenStable();
    expect(fixture.componentInstance.ready()).toBeTrue();
    expect(fixture.componentInstance.qrDrawn()).toBeTrue();
  });

  it('never renders long texts as HTML', () => {
    const el = create({ outline: '<b>粗體</b>' });
    expect(el.querySelector('.section b')).toBeNull();
    expect(el.textContent).toContain('<b>粗體</b>');
  });
});
