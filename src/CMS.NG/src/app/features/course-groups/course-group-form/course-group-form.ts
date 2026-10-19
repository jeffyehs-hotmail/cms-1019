import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CourseGroupRequest } from '../course-group.model';
import { CourseGroupService } from '../course-group.service';

@Component({
  selector: 'app-course-group-form',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule],
  templateUrl: './course-group-form.html',
})
export class CourseGroupForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CourseGroupService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  /** Route param `:id` (CourseGroup.pkid); absent on /course-groups/new. */
  readonly id = input<string>();

  readonly isEdit = computed(() => !!this.id());
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    // Whitespace-only is rejected by the API's [Required]; mirror that here.
    description: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
  });

  ngOnInit(): void {
    if (!this.isEdit()) return;

    this.service.getById(Number(this.id())).subscribe({
      next: (group) => this.form.patchValue({ description: group.description }),
      error: () => this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入資料' }),
    });
  }

  showError(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  /** Error text for a text control: required / maxlength. */
  errorText(name: keyof typeof this.form.controls, label: string, max: number): string {
    const c = this.form.controls[name];
    if (c.hasError('maxlength')) return `最多 ${max} 字`;
    return `請輸入${label}`;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const request: CourseGroupRequest = { description: v.description.trim() };
    if (this.isEdit()) request.pkid = Number(this.id());

    this.saving.set(true);
    const call = this.isEdit() ? this.service.update(request) : this.service.create(request);
    call.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: `課程群組「${saved.description}」已儲存` });
        this.router.navigate(['/course-groups', saved.pkid]);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const detail = err.status === 409 ? (err.error?.message ?? '儲存失敗') : '儲存失敗';
        this.messages.add({ severity: 'error', summary: '錯誤', detail });
      },
    });
  }

  cancel(): void {
    this.router.navigate(this.isEdit() ? ['/course-groups', this.id()] : ['/course-groups']);
  }
}
