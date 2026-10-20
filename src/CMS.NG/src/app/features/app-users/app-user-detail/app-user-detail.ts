import { Component, OnInit, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { RowAuditBadge } from '../../../core/components/row-audit-badge/row-audit-badge';
import { AppUser } from '../app-user.model';
import { AppUserService } from '../app-user.service';
import { ResetPasswordButton } from '../reset-password-button/reset-password-button';
import { isServerError } from '../../../core/utils/server-error';

@Component({
  selector: 'app-app-user-detail',
  imports: [DatePipe, ButtonModule, ChipModule, DialogModule, InputTextModule, ResetPasswordButton, RowAuditBadge],
  templateUrl: './app-user-detail.html',
  styles: `
    .role-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .token-actions {
      display: flex;
      gap: 0.5rem;
    }
    .token-row {
      display: flex;
      gap: 0.5rem;
    }
    .token-row input {
      flex: 1;
      font-family: monospace;
    }
  `,
})
export class AppUserDetail implements OnInit {
  private readonly service = inject(AppUserService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  /** Route param `:id` (AppUser.pkid). */
  readonly id = input.required<string>();

  readonly user = signal<AppUser | null>(null);
  readonly notFound = signal(false);
  readonly tokenBusy = signal(false);
  /** Newly issued agent token; shown once in the dialog and dropped when it closes. */
  readonly issuedToken = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.service.getById(Number(this.id())).subscribe({
      next: (user) => this.user.set(user),
      error: (err) => {
        this.notFound.set(true);
        if (err?.status !== 404 && !isServerError(err)) {
          this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入使用者資料' });
        }
      },
    });
  }

  back(): void {
    this.router.navigate(['/app-users']);
  }

  edit(): void {
    this.router.navigate(['/app-users', this.id(), 'edit']);
  }

  confirmRegenerateAgentToken(): void {
    const user = this.user();
    if (!user) return;
    if (!user.hasAgentToken) {
      this.regenerateAgentToken(user);
      return;
    }
    this.confirmation.confirm({
      header: '重新產生 Agent Token',
      message: `確定要重新產生使用者「${user.userId}」的 Agent Token？舊的 Token 將立即失效。`,
      icon: 'pi pi-refresh',
      acceptLabel: '重新產生',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'warn' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.regenerateAgentToken(user),
    });
  }

  private regenerateAgentToken(user: AppUser): void {
    this.tokenBusy.set(true);
    this.service.regenerateAgentToken(user.pkid).subscribe({
      next: (res) => {
        this.tokenBusy.set(false);
        this.issuedToken.set(res.token);
        this.load();
      },
      error: (err) => {
        this.tokenBusy.set(false);
        if (!isServerError(err)) {
          this.messages.add({ severity: 'error', summary: '錯誤', detail: err?.error?.message ?? '產生 Agent Token 失敗' });
        }
      },
    });
  }

  confirmRevokeAgentToken(): void {
    const user = this.user();
    if (!user?.hasAgentToken) return;
    this.confirmation.confirm({
      header: '撤銷 Agent Token',
      message: `確定要撤銷使用者「${user.userId}」的 Agent Token？之後的用量回報將被拒絕。`,
      icon: 'pi pi-ban',
      acceptLabel: '撤銷',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.revokeAgentToken(user),
    });
  }

  private revokeAgentToken(user: AppUser): void {
    this.tokenBusy.set(true);
    this.service.revokeAgentToken(user.pkid).subscribe({
      next: () => {
        this.tokenBusy.set(false);
        this.messages.add({ severity: 'success', summary: '已撤銷', detail: `使用者「${user.userId}」的 Agent Token 已撤銷` });
        this.load();
      },
      error: (err) => {
        this.tokenBusy.set(false);
        if (!isServerError(err)) {
          this.messages.add({ severity: 'error', summary: '錯誤', detail: err?.error?.message ?? '撤銷 Agent Token 失敗' });
        }
      },
    });
  }

  async copyToken(): Promise<void> {
    const token = this.issuedToken();
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      this.messages.add({ severity: 'success', summary: '已複製', detail: 'Agent Token 已複製到剪貼簿' });
    } catch {
      this.messages.add({ severity: 'warn', summary: '無法複製', detail: '請手動選取並複製 Token' });
    }
  }

  closeTokenDialog(): void {
    this.issuedToken.set(null);
  }
}
