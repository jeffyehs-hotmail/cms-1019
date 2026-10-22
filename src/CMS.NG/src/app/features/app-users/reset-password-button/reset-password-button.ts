import { Component, inject, input, output, signal } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../../core/auth/auth.service';
import { AppUserService } from '../app-user.service';
import { isServerError } from '../../../core/utils/server-error';

/**
 * 重設密碼 button for the AppUser detail page and edit form: confirms, then resets the user's password to the
 * SysConfig default. Rendered only for the Admin role (the API also returns 403 to anyone else). Sends only the
 * pkid; no password or hash goes either way.
 */
@Component({
  selector: 'app-reset-password-button',
  imports: [ButtonModule],
  template: `
    @if (auth.isAdmin()) {
      <p-button
        label="重設密碼"
        icon="pi pi-key"
        severity="warn"
        [outlined]="true"
        [loading]="resetting()"
        (onClick)="confirmReset()"
        data-action="reset-password"
      />
    }
  `,
})
export class ResetPasswordButton {
  protected readonly auth = inject(AuthService);
  private readonly service = inject(AppUserService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  /** AppUser.pkid of the user being viewed or edited. */
  readonly pkid = input.required<number>();
  /** Shown in the confirmation and toast. */
  readonly userId = input.required<string>();
  /** Emitted after a successful reset (e.g. to reload the password update time). */
  readonly reset = output<void>();

  readonly resetting = signal(false);

  confirmReset(): void {
    const userId = this.userId();
    this.confirmation.confirm({
      header: '重設密碼',
      message: `確定要將使用者「${userId}」的密碼重設為系統預設密碼？`,
      icon: 'pi pi-key',
      acceptLabel: '重設',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'warn' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.resetPassword(userId),
    });
  }

  private resetPassword(userId: string): void {
    this.resetting.set(true);
    this.service.resetPassword(this.pkid()).subscribe({
      next: () => {
        this.resetting.set(false);
        this.messages.add({ severity: 'success', summary: '已重設', detail: `使用者「${userId}」的密碼已重設為預設密碼` });
        this.reset.emit();
      },
      error: (err) => {
        this.resetting.set(false);
        if (!isServerError(err)) {
          this.messages.add({ severity: 'error', summary: '錯誤', detail: err?.error?.message ?? '重設密碼失敗' });
        }
      },
    });
  }
}
