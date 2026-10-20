import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { InputTextModule } from 'primeng/inputtext';
import { UserProfile } from '../../core/auth/auth.model';
import { AuthService } from '../../core/auth/auth.service';
import {
  PASSWORD_POLICY_MESSAGE,
  passwordPolicyValidator,
  passwordsMatchValidator,
} from '../../core/auth/password-policy';

/** At least one non-whitespace character. */
const NOT_BLANK = Validators.pattern(/\S/);

/**
 * 我的個人資料: the signed-in user sees their UserId and roles, can change only their own UserName,
 * and can change their own password (current + new + confirm).
 */
@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, ButtonModule, ChipModule, InputTextModule],
  templateUrl: './profile.html',
  styles: `
    .policy-hint,
    small.error {
      white-space: pre-line;
    }
    .role-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
})
export class Profile implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);

  readonly profile = signal<UserProfile | null>(null);
  readonly saving = signal(false);
  readonly changingPassword = signal(false);
  readonly passwordPolicyMessage = PASSWORD_POLICY_MESSAGE;

  readonly form = this.fb.nonNullable.group({
    userName: ['', [Validators.required, Validators.maxLength(200), NOT_BLANK]],
  });

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, passwordPolicyValidator]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator('newPassword', 'confirmPassword') },
  );

  ngOnInit(): void {
    this.auth.getProfile().subscribe({
      next: (p) => this.load(p),
      error: (err: HttpErrorResponse) =>
        this.messages.add({ severity: 'error', summary: '錯誤', detail: err.error?.message ?? '無法載入資料' }),
    });
  }

  private load(p: UserProfile): void {
    this.profile.set(p);
    this.form.reset({ userName: p.userName });
  }

  showError(): boolean {
    const c = this.form.controls.userName;
    return c.invalid && (c.touched || c.dirty);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.auth.updateProfile({ userName: this.form.getRawValue().userName.trim() }).subscribe({
      next: (p) => {
        this.saving.set(false);
        this.load(p);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: '個人資料已更新' });
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.messages.add({ severity: 'error', summary: '錯誤', detail: err.error?.message ?? '儲存失敗' });
      },
    });
  }

  /** The error text under a password field, or null; shown once the field is touched or dirty. */
  passwordError(field: 'currentPassword' | 'newPassword' | 'confirmPassword'): string | null {
    const c = this.passwordForm.controls[field];
    if (!(c.touched || c.dirty)) return null;
    if (c.hasError('required')) {
      return { currentPassword: '請輸入目前密碼', newPassword: '請輸入新密碼', confirmPassword: '請再次輸入新密碼' }[field];
    }
    if (field === 'newPassword' && c.hasError('passwordPolicy')) return PASSWORD_POLICY_MESSAGE;
    if (field === 'confirmPassword' && this.passwordForm.hasError('passwordMismatch')) return '新密碼與確認新密碼不一致';
    return null;
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.changingPassword.set(true);
    this.auth.changePassword(this.passwordForm.getRawValue()).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.passwordForm.reset();
        this.messages.add({ severity: 'success', summary: '已變更', detail: '密碼已變更' });
      },
      error: (err: HttpErrorResponse) => {
        this.changingPassword.set(false);
        this.messages.add({ severity: 'error', summary: '錯誤', detail: err.error?.message ?? '變更密碼失敗' });
      },
    });
  }
}
