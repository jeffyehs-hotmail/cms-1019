import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { Partner, PartnerRequest } from '../partner.model';
import { PartnerService } from '../partner.service';

/** varchar columns (AppKey, ImageFilename): printable ASCII only. */
const ASCII = /^[\x20-\x7E]*$/;

@Component({
  selector: 'app-partner-form',
  imports: [ReactiveFormsModule, ButtonModule, InputNumberModule, InputTextModule],
  templateUrl: './partner-form.html',
})
export class PartnerForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PartnerService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  /** Route param `:id` (Partner.pkid); absent on /partners/new. */
  readonly id = input<string>();

  readonly isEdit = computed(() => !!this.id());
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(50)]],
    appKey: ['', [Validators.required, Validators.maxLength(10), Validators.pattern(ASCII)]],
    nameOnPartnerMenu: ['', [Validators.required, Validators.maxLength(200)]],
    nameOnCourseDetailPage: ['', [Validators.required, Validators.maxLength(50)]],
    displayOrder: [0 as number | null, [Validators.required]],
    imageFilename: ['', [Validators.maxLength(50), Validators.pattern(ASCII)]],
  });

  ngOnInit(): void {
    if (!this.isEdit()) return;

    this.service.getById(Number(this.id())).subscribe({
      next: (partner) => this.patch(partner),
      error: () => this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入資料' }),
    });
  }

  private patch(p: Partner): void {
    this.form.patchValue({
      name: p.name,
      appKey: p.appKey,
      nameOnPartnerMenu: p.nameOnPartnerMenu,
      nameOnCourseDetailPage: p.nameOnCourseDetailPage,
      displayOrder: p.displayOrder,
      imageFilename: p.imageFilename ?? '',
    });
  }

  showError(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  /** Error text for a text control: required / maxlength / ASCII pattern. */
  errorText(name: keyof typeof this.form.controls, label: string, max: number): string {
    const c = this.form.controls[name];
    if (c.hasError('maxlength')) return `最多 ${max} 字`;
    if (c.hasError('pattern')) return '僅限英數字元';
    return `請輸入${label}`;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const imageFilename = v.imageFilename.trim();
    const request: PartnerRequest = {
      name: v.name.trim(),
      appKey: v.appKey.trim(),
      nameOnPartnerMenu: v.nameOnPartnerMenu.trim(),
      nameOnCourseDetailPage: v.nameOnCourseDetailPage.trim(),
      displayOrder: v.displayOrder!,
      imageFilename: imageFilename ? imageFilename : null,
    };
    if (this.isEdit()) request.pkid = Number(this.id());

    this.saving.set(true);
    const call = this.isEdit() ? this.service.update(request) : this.service.create(request);
    call.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: `原廠「${saved.name}」已儲存` });
        this.router.navigate(['/partners', saved.pkid]);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const detail = err.status === 409 ? (err.error?.message ?? '應用代碼已存在') : '儲存失敗';
        this.messages.add({ severity: 'error', summary: '錯誤', detail });
      },
    });
  }

  cancel(): void {
    this.router.navigate(this.isEdit() ? ['/partners', this.id()] : ['/partners']);
  }
}
