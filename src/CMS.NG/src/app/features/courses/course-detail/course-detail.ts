import { Component, OnInit, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { TooltipModule } from 'primeng/tooltip';
import { QrCode } from '../../../core/components/qr-code/qr-code';
import { Course, TEXT_FIELDS, courseInUse, courseUrl } from '../course.model';
import { CourseService } from '../course.service';

@Component({
  selector: 'app-course-detail',
  imports: [DatePipe, DecimalPipe, RouterLink, ButtonModule, ChipModule, TooltipModule, QrCode],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss',
})
export class CourseDetail implements OnInit {
  private readonly service = inject(CourseService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

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
        if (err?.status !== 404) {
          this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入課程資料' });
        }
      },
    });
  }

  readonly courseUrl = courseUrl;

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
