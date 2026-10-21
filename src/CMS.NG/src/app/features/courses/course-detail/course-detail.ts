import { Component, HostListener, OnDestroy, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { QrCode } from '../../../core/components/qr-code/qr-code';
import { toIsoDate } from '../../../core/utils/date.util';
import { Course, QrOmitReason, TEXT_FIELDS, courseInUse, courseUrl, qrOmitReason } from '../course.model';
import { CourseService } from '../course.service';
import { brochureFooterText, printTitle, toCssString } from '../course-brochure/brochure-print';
import { CourseBrochure } from '../course-brochure/course-brochure';

/** Banner text per reason the printed brochure has no QR code (eng re-run D23 + DX fix clauses). */
export const QR_BANNER: Record<QrOmitReason | 'drawFailed', string> = {
  unpublished: '列印PDF 將不含 QR Code：此課程未發布。如需 QR Code，請將發布狀態改為上架',
  expired: '列印PDF 將不含 QR Code：此課程已下架。如需 QR Code，請調整上架／下架日期',
  notStarted: '列印PDF 將不含 QR Code：此課程尚未上架。如需 QR Code，請調整上架／下架日期',
  drawFailed: '列印PDF 將不含 QR Code：QR Code 產生失敗。可重新整理頁面再試，或直接列印（不含 QR Code）',
};

const FOOTER_VAR = '--brochure-footer';

@Component({
  selector: 'app-course-detail',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    ButtonModule,
    ChipModule,
    MessageModule,
    TooltipModule,
    QrCode,
    CourseBrochure,
  ],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss',
})
export class CourseDetail implements OnInit, OnDestroy {
  private readonly service = inject(CourseService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  /** Route param `:id` (Course.pkid). */
  readonly id = input.required<string>();

  readonly course = signal<Course | null>(null);
  readonly notFound = signal(false);
  readonly textFields = TEXT_FIELDS;
  /** Local `yyyy-MM-dd`, set once per load and shared by the banner and the brochure (eng F7). */
  readonly today = signal(toIsoDate(new Date()));

  // Read only the brochure's input-free signals (qrDrawn, qrFailed): the header binds before the
  // brochure's inputs on the first pass. The omit rule itself is the shared qrOmitReason (eng re-run D19).
  private readonly brochure = viewChild(CourseBrochure);
  private readonly omitReason = computed(() => {
    const c = this.course();
    return c ? qrOmitReason(c, this.today()) : null;
  });
  /** True when the brochure is final (QR drawn, omitted or failed) and 列印PDF can print it. */
  readonly printReady = computed(() => {
    const b = this.brochure();
    return !!this.course() && (this.omitReason() !== null || !!b?.qrFailed() || !!b?.qrDrawn());
  });
  /** Why the printout will have no QR code, or null. */
  readonly qrBanner = computed(() => {
    const reason = this.omitReason() ?? (this.brochure()?.qrFailed() ? 'drawFailed' : null);
    return reason ? QR_BANNER[reason] : null;
  });

  /** Document title before printing renamed it; null when no print is in progress. */
  private savedTitle: string | null = null;
  private printedBeforeReady = false;

  ngOnInit(): void {
    this.service.getById(Number(this.id())).subscribe({
      next: (course) => {
        this.today.set(toIsoDate(new Date()));
        this.course.set(course);
      },
      error: (err) => {
        this.notFound.set(true);
        if (err?.status !== 404) {
          this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入課程資料' });
        }
      },
    });
  }

  readonly courseUrl = courseUrl;

  ngOnDestroy(): void {
    this.restorePrint();
  }

  /** 列印PDF: the print setup itself runs in `beforePrint`, which Ctrl+P also triggers (autoplan design S1). */
  print(): void {
    window.print();
  }

  // HostListener bindings are removed with the component, so other pages' prints are untouched (eng F6).
  @HostListener('window:beforeprint')
  beforePrint(): void {
    this.restorePrint(); // a missed afterprint must not leave stale state
    const c = this.course();
    if (!c) return; // the .print-only block prints its "please wait" line
    this.savedTitle = document.title;
    document.title = printTitle(c.courseId);
    document.documentElement.style.setProperty(FOOTER_VAR, toCssString(brochureFooterText(c.title, this.today())));
    this.printedBeforeReady = !this.printReady();
  }

  @HostListener('window:afterprint')
  afterPrint(): void {
    const warn = this.printedBeforeReady;
    this.restorePrint();
    if (warn) {
      console.warn('[CourseDetail] printed before the QR code was ready', this.course()?.courseId);
      this.messages.add({
        severity: 'warn',
        summary: '注意',
        detail: '列印時 QR Code 尚未產生完成，PDF 可能不含 QR Code，請重新列印',
      });
    }
  }

  private restorePrint(): void {
    if (this.savedTitle !== null) document.title = this.savedTitle;
    this.savedTitle = null;
    this.printedBeforeReady = false;
    document.documentElement.style.removeProperty(FOOTER_VAR);
  }

  text(c: Course, key: keyof Course): string | null {
    return c[key] as string | null;
  }

  inUse(c: Course): boolean {
    return courseInUse(c);
  }

  back(): void {
    this.router.navigate(['/courses']);
  }

  edit(): void {
    this.router.navigate(['/courses', this.id(), 'edit']);
  }

  confirmDelete(c: Course): void {
    if (this.inUse(c)) return;
    this.confirmation.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${c.pkid}</b>「${c.courseId} ${c.title}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () =>
        this.service.delete(c.pkid).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: '已刪除', detail: `課程「${c.courseId}」已刪除` });
            this.back();
          },
          error: (err: HttpErrorResponse) => {
            const detail = err.status === 409 ? (err.error?.message ?? '使用中，無法刪除') : '刪除失敗';
            this.messages.add({ severity: 'error', summary: '錯誤', detail });
          },
        }),
    });
  }
}
