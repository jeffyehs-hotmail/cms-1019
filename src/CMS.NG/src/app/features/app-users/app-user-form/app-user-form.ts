import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { LookupService } from '../../../core/services/lookup.service';
import { AppUser, AppUserRequest } from '../app-user.model';
import { AppUserService } from '../app-user.service';
import { ResetPasswordButton } from '../reset-password-button/reset-password-button';

interface RoleOption {
  roleId: string;
  label: string;
}

/** At least one non-whitespace character. */
const NOT_BLANK = Validators.pattern(/\S/);

@Component({
  selector: 'app-app-user-form',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MultiSelectModule, ToggleSwitchModule, ResetPasswordButton],
  templateUrl: './app-user-form.html',
})
export class AppUserForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AppUserService);
  private readonly lookups = inject(LookupService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  /** Route param `:id` (AppUser.pkid); absent on /app-users/new. */
  readonly id = input<string>();

  readonly isEdit = computed(() => !!this.id());
  readonly roleOptions = signal<RoleOption[]>([]);
  readonly saving = signal(false);
  /** The user being edited, once loaded (edit mode only). */
  readonly loaded = signal<AppUser | null>(null);

  readonly form = this.fb.nonNullable.group({
    userId: ['', [Validators.required, Validators.maxLength(200), NOT_BLANK]],
    userName: ['', [Validators.required, Validators.maxLength(200), NOT_BLANK]],
    isActive: [true],
    roleIds: [[] as string[]],
  });

  ngOnInit(): void {
    if (this.isEdit()) this.form.controls.userId.disable();

    forkJoin({
      roles: this.lookups.getAppRoles(),
      user: this.isEdit() ? this.service.getById(Number(this.id())) : of(null),
    }).subscribe({
      next: ({ roles, user }) => {
        this.roleOptions.set(roles.map((r) => ({ roleId: r.roleId, label: `${r.roleName} (${r.roleId})` })));
        if (user) this.patch(user);
      },
      error: () => this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入資料' }),
    });
  }

  private patch(user: AppUser): void {
    this.loaded.set(user);
    this.form.patchValue({
      userId: user.userId,
      userName: user.userName,
      isActive: user.isActive,
      roleIds: user.roles.map((r) => r.roleId),
    });
  }

  showError(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const request: AppUserRequest = {
      pkid: this.isEdit() ? Number(this.id()) : 0,
      userId: v.userId.trim(),
      userName: v.userName.trim(),
      isActive: v.isActive,
      roleIds: v.roleIds,
    };

    this.saving.set(true);
    const call = this.isEdit() ? this.service.update(request) : this.service.create(request);
    call.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: `使用者「${saved.userId}」已儲存` });
        this.router.navigate(['/app-users', saved.pkid]);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.messages.add({ severity: 'error', summary: '錯誤', detail: err.error?.message ?? '儲存失敗' });
      },
    });
  }

  cancel(): void {
    this.router.navigate(this.isEdit() ? ['/app-users', this.id()] : ['/app-users']);
  }
}
