import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  /** Query param `?returnUrl=` set by the auth guard / 401 handler. */
  readonly returnUrl = input<string>();

  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    userId: ['', Validators.required],
    password: ['', Validators.required],
  });

  showError(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const detail = err.status === 401 ? (err.error?.message ?? '帳號或密碼錯誤') : '登入失敗，請稍後再試';
        this.messages.add({ severity: 'error', summary: '登入失敗', detail });
      },
    });
  }
}

/** Only same-app paths (no `//host`, no loop back to /login); anything else goes home. */
export function safeReturnUrl(url: string | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\') || url.startsWith('/login')) return '/';
  return url;
}
