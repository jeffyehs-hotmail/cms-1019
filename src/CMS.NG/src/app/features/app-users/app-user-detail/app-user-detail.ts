import { Component, OnInit, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { AppUser } from '../app-user.model';
import { AppUserService } from '../app-user.service';

@Component({
  selector: 'app-app-user-detail',
  imports: [DatePipe, ButtonModule, ChipModule],
  templateUrl: './app-user-detail.html',
  styles: `
    .role-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
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
  readonly resetting = signal(false);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.service.getById(Number(this.id())).subscribe({
      next: (user) => this.user.set(user),
      error: (err) => {
        this.notFound.set(true);
        if (err?.status !== 404) {
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

  confirmResetPassword(): void {
    const user = this.user();
    if (!user) return;
    this.confirmation.confirm({
      header: '重設密碼',
      message: `確定要將使用者「${user.userId}」的密碼重設為系統預設密碼？`,
      icon: 'pi pi-key',
      acceptLabel: '重設',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'warn' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.resetPassword(user),
    });
  }

  private resetPassword(user: AppUser): void {
    this.resetting.set(true);
    this.service.resetPassword(user.pkid).subscribe({
      next: () => {
        this.resetting.set(false);
        this.messages.add({ severity: 'success', summary: '已重設', detail: `使用者「${user.userId}」的密碼已重設為預設密碼` });
        this.load();
      },
      error: (err) => {
        this.resetting.set(false);
        this.messages.add({ severity: 'error', summary: '錯誤', detail: err?.error?.message ?? '重設密碼失敗' });
      },
    });
  }
}
