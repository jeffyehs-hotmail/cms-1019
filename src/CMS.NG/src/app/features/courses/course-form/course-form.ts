import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import {
  CertificationLookup,
  CourseGroupLookup,
  JobCategoryLookup,
  PartnerLookup,
  PublishStatusLookup,
} from '../../../core/models/lookup.model';
import { LookupService } from '../../../core/services/lookup.service';
import { parseIsoDate, toIsoDate } from '../../../core/utils/date.util';
import { RowAuditBadge } from '../../../core/components/row-audit-badge/row-audit-badge';
import { Course, CourseRequest } from '../course.model';
import { CourseService } from '../course.service';
import { isServerError } from '../../../core/utils/server-error';

/** varchar columns (CourseId, ProdCourseId): printable ASCII only. */
const ASCII = /^[\x20-\x7E]*$/;

/** Long-text controls in the 課程內容 card, in display order. */
export const TEXT_CONTROLS = [
  { key: 'material', label: '教材', max: 500 },
  { key: 'target', label: '適合對象', max: 500 },
  { key: 'objective', label: '課程目標', max: 4000 },
  { key: 'prerequisites', label: '預備知識', max: 4000 },
  { key: 'outline', label: '課程大綱', max: null },
  { key: 'towardCertOrExam', label: '相關認證／考試', max: null },
  { key: 'note', label: '備註', max: 4000 },
  { key: 'otherInfo', label: '其他資訊', max: 4000 },
] as const;

type TextKey = (typeof TEXT_CONTROLS)[number]['key'];

/** Group validator: ScheduleOff must not be before ScheduleOn. */
export function scheduleRangeValidator(group: AbstractControl): ValidationErrors | null {
  const on = group.get('scheduleOn')?.value as Date | null;
  const off = group.get('scheduleOff')?.value as Date | null;
  return on && off && toIsoDate(off) < toIsoDate(on) ? { scheduleRange: true } : null;
}

@Component({
  selector: 'app-course-form',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DatePickerModule,
    InputNumberModule,
    InputTextModule,
    MultiSelectModule,
    SelectModule,
    TextareaModule,
    ToggleSwitchModule,
    RowAuditBadge,
  ],
  templateUrl: './course-form.html',
  styleUrl: './course-form.scss',
})
export class CourseForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CourseService);
  private readonly lookups = inject(LookupService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  /** Route param `:id` (Course.pkid); absent on /courses/new. */
  readonly id = input<string>();

  readonly isEdit = computed(() => !!this.id());
  readonly saving = signal(false);
  readonly textControls = TEXT_CONTROLS;

  readonly partners = signal<PartnerLookup[]>([]);
  readonly courseGroups = signal<CourseGroupLookup[]>([]);
  readonly publishStatuses = signal<PublishStatusLookup[]>([]);
  readonly certifications = signal<(CertificationLookup & { label: string })[]>([]);
  readonly jobCategories = signal<JobCategoryLookup[]>([]);

  readonly form = this.fb.group(
    {
      courseId: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(50), Validators.pattern(ASCII)]),
      prodCourseId: this.fb.nonNullable.control('', [
        Validators.required,
        Validators.maxLength(50),
        Validators.pattern(ASCII),
      ]),
      title: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(200)]),
      officialTitle: this.fb.nonNullable.control('', [Validators.maxLength(300)]),
      friendlyUrl: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(100)]),
      partnerPkid: this.fb.control<number | null>(null, [Validators.required]),
      courseGroupPkid: this.fb.control<number | null>(null),
      publishStatusPkid: this.fb.control<number | null>(null, [Validators.required]),
      displayOrder: this.fb.control<number | null>(0, [Validators.required]),
      scheduleOn: this.fb.control<Date | null>(null, [Validators.required]),
      scheduleOff: this.fb.control<Date | null>(null, [Validators.required]),
      hour: this.fb.control<number | null>(0, [Validators.required]),
      listPrice: this.fb.control<number | null>(0, [Validators.required]),
      learningCredit: this.fb.control<number | null>(0, [Validators.required]),
      canRepeat: this.fb.nonNullable.control(false),
      certificationPkids: this.fb.nonNullable.control<number[]>([]),
      jobCategoryPkids: this.fb.nonNullable.control<number[]>([]),
      material: this.fb.nonNullable.control('', [Validators.maxLength(500)]),
      target: this.fb.nonNullable.control('', [Validators.maxLength(500)]),
      objective: this.fb.nonNullable.control('', [Validators.maxLength(4000)]),
      prerequisites: this.fb.nonNullable.control('', [Validators.maxLength(4000)]),
      outline: this.fb.nonNullable.control(''),
      towardCertOrExam: this.fb.nonNullable.control(''),
      note: this.fb.nonNullable.control('', [Validators.maxLength(4000)]),
      otherInfo: this.fb.nonNullable.control('', [Validators.maxLength(4000)]),
    },
    { validators: scheduleRangeValidator },
  );

  ngOnInit(): void {
    if (!this.isEdit()) {
      // Most courses are delisted at the end of a year — default to Dec 31 next year.
      const today = new Date();
      this.form.patchValue({
        scheduleOn: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        scheduleOff: new Date(today.getFullYear() + 1, 11, 31),
      });
    }

    const course$: Observable<Course | null> = this.isEdit() ? this.service.getById(Number(this.id())) : of(null);
    forkJoin({
      partners: this.lookups.getPartners(),
      courseGroups: this.lookups.getCourseGroups(),
      publishStatuses: this.lookups.getPublishStatuses(),
      certifications: this.lookups.getCertifications(),
      jobCategories: this.lookups.getJobCategories(),
      course: course$,
    }).subscribe({
      next: (r) => {
        this.partners.set(r.partners);
        this.courseGroups.set(r.courseGroups);
        this.publishStatuses.set(r.publishStatuses);
        this.certifications.set(r.certifications.map((c) => ({ ...c, label: `${c.partnerName} ‧ ${c.title}` })));
        this.jobCategories.set(r.jobCategories);
        if (r.course) this.patch(r.course);
      },
      error: (err: unknown) => {
        if (!isServerError(err)) this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入資料' });
      },
    });
  }

  private patch(c: Course): void {
    this.form.patchValue({
      courseId: c.courseId,
      prodCourseId: c.prodCourseId,
      title: c.title,
      officialTitle: c.officialTitle ?? '',
      friendlyUrl: c.friendlyUrl,
      partnerPkid: c.partnerPkid,
      courseGroupPkid: c.courseGroupPkid,
      publishStatusPkid: c.publishStatusPkid,
      displayOrder: c.displayOrder,
      scheduleOn: parseIsoDate(c.scheduleOn),
      scheduleOff: parseIsoDate(c.scheduleOff),
      hour: c.hour,
      listPrice: c.listPrice,
      learningCredit: c.learningCredit,
      canRepeat: c.canRepeat,
      certificationPkids: c.certifications.map((x) => x.pkid),
      jobCategoryPkids: c.jobCategories.map((x) => x.pkid),
      material: c.material ?? '',
      target: c.target ?? '',
      objective: c.objective ?? '',
      prerequisites: c.prerequisites ?? '',
      outline: c.outline ?? '',
      towardCertOrExam: c.towardCertOrExam ?? '',
      note: c.note ?? '',
      otherInfo: c.otherInfo ?? '',
    });
  }

  showError(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  /** ScheduleOff < ScheduleOn — shown once either date has been touched. */
  showRangeError(): boolean {
    const { scheduleOn, scheduleOff } = this.form.controls;
    return this.form.hasError('scheduleRange') && (scheduleOn.touched || scheduleOff.touched || scheduleOff.dirty);
  }

  /** Error text for a text control: required / maxlength / ASCII pattern. */
  errorText(name: keyof typeof this.form.controls, label: string, max: number | null): string {
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
    const opt = (s: string) => (s.trim() ? s.trim() : null);
    const texts = Object.fromEntries(TEXT_CONTROLS.map((t) => [t.key, opt(v[t.key])])) as Record<TextKey, string | null>;
    const request: CourseRequest = {
      courseId: v.courseId.trim(),
      prodCourseId: v.prodCourseId.trim(),
      title: v.title.trim(),
      officialTitle: opt(v.officialTitle),
      friendlyUrl: v.friendlyUrl.trim(),
      partnerPkid: v.partnerPkid!,
      courseGroupPkid: v.courseGroupPkid ?? null,
      publishStatusPkid: v.publishStatusPkid!,
      displayOrder: v.displayOrder!,
      scheduleOn: toIsoDate(v.scheduleOn!),
      scheduleOff: toIsoDate(v.scheduleOff!),
      hour: v.hour!,
      listPrice: v.listPrice!,
      learningCredit: v.learningCredit!,
      canRepeat: v.canRepeat,
      certificationPkids: v.certificationPkids,
      jobCategoryPkids: v.jobCategoryPkids,
      ...texts,
    };
    if (this.isEdit()) request.pkid = Number(this.id());

    this.saving.set(true);
    const call = this.isEdit() ? this.service.update(request) : this.service.create(request);
    call.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: `課程「${saved.courseId}」已儲存` });
        this.router.navigate(['/courses', saved.pkid]);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const detail =
          err.status === 409 || err.status === 400
            ? (err.error?.message ?? (err.status === 409 ? '簡介代碼已存在' : '資料驗證失敗'))
            : '儲存失敗';
        if (!isServerError(err)) this.messages.add({ severity: 'error', summary: '錯誤', detail });
      },
    });
  }

  cancel(): void {
    this.router.navigate(this.isEdit() ? ['/courses', this.id()] : ['/courses']);
  }
}
