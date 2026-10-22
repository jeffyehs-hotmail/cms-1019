import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { LookupService } from '../../../core/services/lookup.service';
import { RowAuditBadge } from '../../../core/components/row-audit-badge/row-audit-badge';
import { AppRole, AppRoleRequest } from '../app-role.model';
import { AppRoleService } from '../app-role.service';
import { errorMessage, isServerError } from '../../../core/utils/server-error';

interface UserOption {
  userId: string;
  label: string;
}

@Component({
  selector: 'app-app-role-form',
  imports: [ReactiveFormsModule, ButtonModule, InputNumberModule, InputTextModule, MultiSelectModule, RowAuditBadge],
  templateUrl: './app-role-form.html',
})
export class AppRoleForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AppRoleService);
  private readonly lookups = inject(LookupService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  /** Route param `:id` (AppRole.pkid); absent on /app-roles/new. */
  readonly id = input<string>();

  readonly isEdit = computed(() => !!this.id());
  readonly userOptions = signal<UserOption[]>([]);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    roleId: ['', [Validators.required, Validators.maxLength(200)]],
    roleName: ['', [Validators.required, Validators.maxLength(200)]],
    permissionLevel: [100 as number | null, [Validators.required]],
    description: ['', [Validators.maxLength(400)]],
    userIds: [[] as string[]],
  });

  ngOnInit(): void {
    if (this.isEdit()) this.form.controls.roleId.disable();

    forkJoin({
      users: this.lookups.getAppUsers(),
      role: this.isEdit() ? this.service.getById(Number(this.id())) : of(null),
    }).subscribe({
      next: ({ users, role }) => {
        this.userOptions.set(users.map((u) => ({ userId: u.userId, label: `${u.userName} (${u.userId})` })));
        if (role) this.patch(role);
      },
      error: (err: unknown) => {
        if (!isServerError(err)) this.messages.add({ severity: 'error', summary: '錯誤', detail: errorMessage(err, '無法載入資料') });
      },
    });
  }

  private patch(role: AppRole): void {
    this.form.patchValue({
      roleId: role.roleId,
      roleName: role.roleName,
      permissionLevel: role.permissionLevel,
      description: role.description ?? '',
      userIds: role.users.map((u) => u.userId),
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
    const request: AppRoleRequest = {
      pkid: this.isEdit() ? Number(this.id()) : 0,
      roleId: v.roleId.trim(),
      roleName: v.roleName.trim(),
      permissionLevel: v.permissionLevel ?? 100,
      description: v.description?.trim() || null,
      userIds: v.userIds,
    };

    this.saving.set(true);
    const call = this.isEdit() ? this.service.update(request) : this.service.create(request);
    call.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: `角色「${saved.roleId}」已儲存` });
        this.router.navigate(['/app-roles', saved.pkid]);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const detail = errorMessage(err, err.status === 409 ? '角色代碼已存在' : '儲存失敗');
        if (!isServerError(err)) this.messages.add({ severity: 'error', summary: '錯誤', detail });
      },
    });
  }

  cancel(): void {
    this.router.navigate(this.isEdit() ? ['/app-roles', this.id()] : ['/app-roles']);
  }
}
