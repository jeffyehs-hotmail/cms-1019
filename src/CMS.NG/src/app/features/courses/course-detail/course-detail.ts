import { Component, OnInit, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { TooltipModule } from 'primeng/tooltip';
import { QrCode } from '../../../core/components/qr-code/qr-code';
import { RowAuditBadge } from '../../../core/components/row-audit-badge/row-audit-badge';
import { Course, courseInUse } from '../course.model';
import { CourseService } from '../course.service';
import { isServerError } from '../../../core/utils/server-error';
import { AuthService } from '../../../core/auth/auth.service';

/** Public course page on the website, encoded in the detail page QR code. */
export const COURSE_SITE_URL = 'https://www.uuu.com.tw/Course/Show';

/** Long-text fields shown in the 課程內容 card, in display order. */
export const TEXT_FIELDS: { key: keyof Course; label: string }[] = [
  { key: 'material', label: '教材' },
  { key: 'target', label: '適合對象' },
  { key: 'objective', label: '課程目標' },
  { key: 'prerequisites', label: '預備知識' },
  { key: 'outline', label: '課程大綱' },
  { key: 'towardCertOrExam', label: '相關認證／考試' },
  { key: 'note', label: '備註' },
  { key: 'otherInfo', label: '其他資訊' },
];

@Component({
  selector: 'app-course-detail',
  imports: [DatePipe, DecimalPipe, RouterLink, ButtonModule, ChipModule, TooltipModule, QrCode, RowAuditBadge],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss',
})
export class CourseDetail implements OnInit {
  private readonly service = inject(CourseService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  protected readonly auth = inject(AuthService);

  /** Route param `:id` (Course.pkid). */
  readonly id = input.required<string>();

  readonly course = signal<Course | null>(null);
  readonly notFound = signal(false);
  readonly textFields = TEXT_FIELDS;

  ngOnInit(): void {
    this.service.getById(Number(this.id())).subscribe({
      next: (course) => this.course.set(course),
      error: (err) => {
        this.notFound.set(true);
        if (err?.status !== 404 && !isServerError(err)) {
          this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入課程資料' });
        }
      },
    });
  }

  /** https://www.uuu.com.tw/Course/Show/{pkid}/{CourseId} */
  courseUrl(c: Course): string {
    return `${COURSE_SITE_URL}/${c.pkid}/${encodeURIComponent(c.courseId)}`;
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
            if (!isServerError(err)) this.messages.add({ severity: 'error', summary: '錯誤', detail });
          },
        }),
    });
  }
}
