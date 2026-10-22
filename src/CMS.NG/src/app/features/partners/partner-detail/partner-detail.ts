import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { RowAuditBadge } from '../../../core/components/row-audit-badge/row-audit-badge';
import { Partner } from '../partner.model';
import { PartnerService } from '../partner.service';
import { isServerError } from '../../../core/utils/server-error';

@Component({
  selector: 'app-partner-detail',
  imports: [ButtonModule, RouterLink, RowAuditBadge],
  templateUrl: './partner-detail.html',
})
export class PartnerDetail implements OnInit {
  private readonly service = inject(PartnerService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  /** Route param `:id` (Partner.pkid). */
  readonly id = input.required<string>();

  readonly partner = signal<Partner | null>(null);
  readonly notFound = signal(false);

  ngOnInit(): void {
    this.service.getById(Number(this.id())).subscribe({
      next: (partner) => this.partner.set(partner),
      error: (err) => {
        this.notFound.set(true);
        if (err?.status !== 404 && !isServerError(err)) {
          this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入原廠資料' });
        }
      },
    });
  }

  back(): void {
    this.router.navigate(['/partners']);
  }

  edit(): void {
    this.router.navigate(['/partners', this.id(), 'edit']);
  }
}
