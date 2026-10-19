import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { PublishStatus } from '../publish-status.model';
import { PublishStatusService } from '../publish-status.service';

@Component({
  selector: 'app-publish-status-detail',
  imports: [ButtonModule, RouterLink],
  templateUrl: './publish-status-detail.html',
})
export class PublishStatusDetail implements OnInit {
  private readonly service = inject(PublishStatusService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  /** Route param `:id` (PublishStatus.pkid). */
  readonly id = input.required<string>();

  readonly status = signal<PublishStatus | null>(null);
  readonly notFound = signal(false);

  ngOnInit(): void {
    this.service.getById(Number(this.id())).subscribe({
      next: (status) => this.status.set(status),
      error: (err) => {
        this.notFound.set(true);
        if (err?.status !== 404) {
          this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入發布狀態資料' });
        }
      },
    });
  }

  back(): void {
    this.router.navigate(['/publish-statuses']);
  }

  edit(): void {
    this.router.navigate(['/publish-statuses', this.id(), 'edit']);
  }
}
