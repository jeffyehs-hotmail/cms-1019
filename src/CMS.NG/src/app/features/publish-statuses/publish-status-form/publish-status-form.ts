import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { RowAuditBadge } from '../../../core/components/row-audit-badge/row-audit-badge';
import { PublishStatus, PublishStatusRequest } from '../publish-status.model';
import { PublishStatusService } from '../publish-status.service';
import { isServerError } from '../../../core/utils/server-error';

@Component({
  selector: 'app-publish-status-form',
  imports: [ReactiveFormsModule, ButtonModule, CheckboxModule, InputNumberModule, InputTextModule, RowAuditBadge],
  templateUrl: './publish-status-form.html',
  styleUrl: './publish-status-form.scss',
})
export class PublishStatusForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PublishStatusService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  /** Route param `:id` (PublishStatus.pkid); absent on /publish-statuses/new. */
  readonly id = input<string>();

  readonly isEdit = computed(() => !!this.id());
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    // tinyint, user-supplied (not IDENTITY); immutable once created.
    pkid: [null as number | null, [Validators.required, Validators.min(1), Validators.max(255)]],
    description: ['', [Validators.required, Validators.maxLength(50)]],
    isDraft: [false],
    isPublished: [false],
    isDiscontinued: [false],
  });

  ngOnInit(): void {
    if (!this.isEdit()) return;

    this.form.controls.pkid.disable();
    this.service.getById(Number(this.id())).subscribe({
      next: (status) => this.patch(status),
      error: (err: unknown) => {
        if (!isServerError(err)) this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入資料' });
      },
    });
  }

  private patch(status: PublishStatus): void {
    this.form.patchValue({
      pkid: status.pkid,
      description: status.description,
      isDraft: status.isDraft,
      isPublished: status.isPublished,
      isDiscontinued: status.isDiscontinued,
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
    const request: PublishStatusRequest = {
      pkid: this.isEdit() ? Number(this.id()) : v.pkid!,
      description: v.description.trim(),
      isDraft: v.isDraft,
      isPublished: v.isPublished,
      isDiscontinued: v.isDiscontinued,
    };

    this.saving.set(true);
    const call = this.isEdit() ? this.service.update(request) : this.service.create(request);
    call.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: `發布狀態「${saved.description}」已儲存` });
        this.router.navigate(['/publish-statuses', saved.pkid]);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const detail = err.status === 409 ? (err.error?.message ?? '主代碼已存在') : '儲存失敗';
        if (!isServerError(err)) this.messages.add({ severity: 'error', summary: '錯誤', detail });
      },
    });
  }

  cancel(): void {
    this.router.navigate(this.isEdit() ? ['/publish-statuses', this.id()] : ['/publish-statuses']);
  }
}
