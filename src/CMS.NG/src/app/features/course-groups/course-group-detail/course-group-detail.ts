import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { RowAuditBadge } from '../../../core/components/row-audit-badge/row-audit-badge';
import { CourseGroup } from '../course-group.model';
import { CourseGroupService } from '../course-group.service';
import { isServerError } from '../../../core/utils/server-error';

@Component({
  selector: 'app-course-group-detail',
  imports: [ButtonModule, RouterLink, RowAuditBadge],
  templateUrl: './course-group-detail.html',
})
export class CourseGroupDetail implements OnInit {
  private readonly service = inject(CourseGroupService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  /** Route param `:id` (CourseGroup.pkid). */
  readonly id = input.required<string>();

  readonly courseGroup = signal<CourseGroup | null>(null);
  readonly notFound = signal(false);

  ngOnInit(): void {
    this.service.getById(Number(this.id())).subscribe({
      next: (group) => this.courseGroup.set(group),
      error: (err) => {
        this.notFound.set(true);
        if (err?.status !== 404 && !isServerError(err)) {
          this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入課程群組資料' });
        }
      },
    });
  }

  back(): void {
    this.router.navigate(['/course-groups']);
  }

  edit(): void {
    this.router.navigate(['/course-groups', this.id(), 'edit']);
  }
}
