import { Component, computed, effect, input, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { QrCode } from '../../../core/components/qr-code/qr-code';
import { CONTENT_FIELDS, Course, courseUrl, qrOmitReason } from '../course.model';
import { BROCHURE_COMPANY, BROCHURE_CONTACT, BROCHURE_SECTIONS, SHOW_PRICE } from './course-brochure.config';

/** QR size in CSS px: 30mm at 96 px/in (design review D12). */
const QR_SIZE = 113;

const hasText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * Customer brochure for one course, printed from the detail page (eng review D7).
 * Presentational: the detail page hides it on screen and shows only it in print.
 */
@Component({
  selector: 'app-course-brochure',
  imports: [DecimalPipe, QrCode],
  templateUrl: './course-brochure.html',
  styleUrl: './course-brochure.scss',
})
export class CourseBrochure {
  readonly course = input.required<Course>();
  /** Local `yyyy-MM-dd`, computed once by the detail page so banner and brochure agree (eng F7). */
  readonly today = input.required<string>();

  private readonly qr = viewChild(QrCode);

  readonly company = BROCHURE_COMPANY;
  readonly showPrice = SHOW_PRICE;
  readonly qrSize = QR_SIZE;
  readonly contact = BROCHURE_CONTACT.filter((c) => c.value);

  readonly omitReason = computed(() => qrOmitReason(this.course(), this.today()));
  /** Latched once the QR fails; the QR's `@if` reads omitReason only, never this (eng re-run V1). */
  readonly qrFailed = signal(false);
  /**
   * True once the QR is on the canvas. Unlike `omitReason`, it reads no input, so a parent can query it
   * during its first change-detection pass, before this component's inputs are bound.
   */
  readonly qrDrawn = computed(() => !!this.qr()?.ready());

  readonly url = computed(() => courseUrl(this.course()));
  /** URL caption without the scheme (autoplan design H3). */
  readonly displayUrl = computed(() => this.url().replace(/^https?:\/\//, ''));

  /** 原廠 · {hour} 小時: values only, missing items skipped (design review D8). */
  readonly facts = computed(() => {
    const c = this.course();
    return [c.partnerName, c.hour > 0 ? `${c.hour} 小時` : ''].filter(hasText).join(' · ');
  });
  /** 認證 as plain text joined by 、 (eng re-run D24). */
  readonly certifications = computed(() =>
    this.course().certifications.map((ce) => `${ce.partnerName} ‧ ${ce.title}`).join('、'),
  );
  readonly sections = computed(() => {
    const c = this.course();
    return BROCHURE_SECTIONS.filter((s) => hasText(c[s.key])).map((s) => ({ label: s.label, text: c[s.key] as string }));
  });
  /** False when none of the 6 content fields has text: print 詳細課程內容請洽業務 (eng re-run D25). */
  readonly hasContent = computed(() => CONTENT_FIELDS.some((k) => hasText(this.course()[k])));

  constructor() {
    effect(() => {
      if (this.qr()?.failed()) this.qrFailed.set(true);
    });
  }
}
