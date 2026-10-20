import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { ConfirmationService, MessageService, SortEvent } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CourseGroupLookup, PartnerLookup, PublishStatusLookup } from '../../../core/models/lookup.model';
import { LookupService } from '../../../core/services/lookup.service';
import { parseIsoDate, toIsoDate } from '../../../core/utils/date.util';
import { readSession, writeSession } from '../../../core/utils/session-state';
import { EditableField, fieldLabel, toCourseRequest, validateCell } from '../course-inline-edit';
import { Course, CourseQuery, courseInUse } from '../course.model';
import { CourseService } from '../course.service';
import { isServerError } from '../../../core/utils/server-error';

export const FILTERS_KEY = 'course-list-filters';
export const SORT_KEY = 'course-list-sort';
export const PAGE_KEY = 'course-list-page';

interface SortState {
  field: string;
  order: number;
}

interface PageState {
  first: number;
  rows: number;
}

/** Drawer model: same as CourseQuery but with Date objects for the date pickers. */
interface DraftFilters {
  keyword: string | null;
  partnerPkid: number | null;
  courseGroupPkid: number | null;
  publishStatusPkid: number | null;
  scheduleOnFrom: Date | null;
  scheduleOnTo: Date | null;
  scheduleOffFrom: Date | null;
  scheduleOffTo: Date | null;
  canRepeat: boolean | null;
}

/** The one cell currently in edit mode. */
export interface EditingCell {
  pkid: number;
  field: EditableField;
}

const EMPTY_FILTERS: CourseQuery = {
  keyword: null,
  partnerPkid: null,
  courseGroupPkid: null,
  publishStatusPkid: null,
  scheduleOnFrom: null,
  scheduleOnTo: null,
  scheduleOffFrom: null,
  scheduleOffTo: null,
  canRepeat: null,
};

/** Positive integer from a query-param string, else null. */
function toPkid(v: string | undefined): number | null {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
}

@Component({
  selector: 'app-course-list',
  imports: [
    DatePipe,
    DecimalPipe,
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    ButtonModule,
    CheckboxModule,
    DatePickerModule,
    DrawerModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    TooltipModule,
  ],
  templateUrl: './course-list.html',
  styleUrl: './course-list.scss',
})
export class CourseList implements OnInit {
  private readonly service = inject(CourseService);
  private readonly lookups = inject(LookupService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  /** Query params from parent-entity links (e.g. /courses?partnerPkid=1) — override saved filters. */
  readonly partnerPkid = input<string>();
  readonly courseGroupPkid = input<string>();
  readonly publishStatusPkid = input<string>();

  readonly courses = signal<Course[]>([]);
  readonly loading = signal(false);
  readonly filters = signal<CourseQuery>(readSession(FILTERS_KEY, { ...EMPTY_FILTERS }));
  readonly activeFilterCount = computed(
    () => Object.values(this.filters()).filter((v) => v !== null && v !== undefined && v !== '').length,
  );

  readonly partners = signal<PartnerLookup[]>([]);
  readonly courseGroups = signal<CourseGroupLookup[]>([]);
  readonly publishStatuses = signal<PublishStatusLookup[]>([]);
  private lookupsLoaded = false;

  readonly canRepeatOptions = [
    { label: '全部', value: null },
    { label: '是', value: true },
    { label: '否', value: false },
  ];

  sort: SortState = readSession<SortState>(SORT_KEY, { field: 'displayOrder', order: 1 });
  page: PageState = readSession<PageState>(PAGE_KEY, { first: 0, rows: 20 });

  drawerVisible = false;
  /** Editable copy of filters bound in the drawer; applied on 搜尋. */
  draft: DraftFilters = this.toDraft(this.filters());

  // ---- In-place cell editing (double-click a cell; saved on blur) ----

  /** Cell in edit mode, or null. */
  readonly editing = signal<EditingCell | null>(null);
  /** Raw editor value bound with ngModel (Date for date cells, number for numeric cells…). */
  editValue: unknown = null;
  /** Inline validation message for the editing cell; the cell stays open while set. */
  readonly editError = signal<string | null>(null);
  /** Rows with a PUT in flight (no further edits until it settles). */
  readonly savingPkids = signal<ReadonlySet<number>>(new Set());

  ngOnInit(): void {
    const incoming: CourseQuery = {
      partnerPkid: toPkid(this.partnerPkid()),
      courseGroupPkid: toPkid(this.courseGroupPkid()),
      publishStatusPkid: toPkid(this.publishStatusPkid()),
    };
    if (incoming.partnerPkid || incoming.courseGroupPkid || incoming.publishStatusPkid) {
      this.filters.set({ ...EMPTY_FILTERS, ...incoming });
      writeSession(FILTERS_KEY, this.filters());
      this.onFirstChange(0);
    }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.cancelEdit();
    this.service.query(this.filters()).subscribe({
      next: (rows) => {
        this.courses.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        if (!isServerError(err)) this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入課程資料' });
      },
    });
  }

  inUse(course: Course): boolean {
    return courseInUse(course);
  }

  openFilters(): void {
    this.draft = this.toDraft(this.filters());
    this.drawerVisible = true;
    this.loadLookups();
  }

  applyFilters(): void {
    const d = this.draft;
    const keyword = d.keyword?.trim();
    const iso = (v: Date | null) => (v ? toIsoDate(v) : null);
    this.filters.set({
      keyword: keyword ? keyword : null,
      partnerPkid: d.partnerPkid,
      courseGroupPkid: d.courseGroupPkid,
      publishStatusPkid: d.publishStatusPkid,
      scheduleOnFrom: iso(d.scheduleOnFrom),
      scheduleOnTo: iso(d.scheduleOnTo),
      scheduleOffFrom: iso(d.scheduleOffFrom),
      scheduleOffTo: iso(d.scheduleOffTo),
      canRepeat: d.canRepeat,
    });
    writeSession(FILTERS_KEY, this.filters());
    this.onFirstChange(0);
    this.drawerVisible = false;
    this.load();
  }

  clearFilters(): void {
    this.draft = this.toDraft(EMPTY_FILTERS);
    this.applyFilters();
  }

  onSort(event: SortEvent): void {
    if (!event.field) return;
    this.sort = { field: event.field, order: event.order ?? 1 };
    writeSession(SORT_KEY, this.sort);
  }

  onFirstChange(first: number): void {
    this.page = { ...this.page, first };
    writeSession(PAGE_KEY, this.page);
  }

  onRowsChange(rows: number): void {
    this.page = { ...this.page, rows };
    writeSession(PAGE_KEY, this.page);
  }

  add(): void {
    this.router.navigate(['/courses/new']);
  }

  confirmDelete(course: Course): void {
    if (this.inUse(course)) return;
    this.confirmation.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${course.pkid}</b>「${course.courseId} ${course.title}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.delete(course),
    });
  }

  // ---- In-place editing ----

  isEditing(course: Course, field: EditableField): boolean {
    const e = this.editing();
    return e !== null && e.pkid === course.pkid && e.field === field;
  }

  isSaving(course: Course): boolean {
    return this.savingPkids().has(course.pkid);
  }

  /**
   * Enter edit mode for one cell (bound to `dblclick`). A pending edit on another cell is
   * committed first; if that commit fails validation the new cell is not opened.
   */
  startEdit(course: Course, field: EditableField, event?: Event): void {
    if (this.isSaving(course)) return;
    if (this.editing()) {
      if (this.isEditing(course, field)) return;
      this.commit();
      if (this.editing()) return;
    }
    if (field === 'publishStatusPkid') this.loadLookups();

    const current = course[field];
    this.editValue =
      field === 'scheduleOn' || field === 'scheduleOff' ? parseIsoDate(current as string) : current;
    this.editError.set(null);
    this.editing.set({ pkid: course.pkid, field });

    const cell = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (cell) setTimeout(() => cell.querySelector<HTMLElement>('input')?.focus(), 0);
  }

  /** Leave edit mode without saving. */
  cancelEdit(): void {
    this.editing.set(null);
    this.editError.set(null);
    this.editValue = null;
  }

  /**
   * Validate the editor value and persist it (bound to blur / Enter / selection). Validation
   * failures keep the cell open with an inline message; an unchanged value just closes it.
   */
  commit(): void {
    const e = this.editing();
    if (!e) return;
    const row = this.courses().find((c) => c.pkid === e.pkid);
    if (!row) {
      this.cancelEdit();
      return;
    }

    const result = validateCell(e.field, this.editValue, row);
    if (!result.ok) {
      this.editError.set(result.error);
      return;
    }

    this.cancelEdit();
    if (result.value === row[e.field]) return;
    this.saveCell(row, e.field, result.value);
  }

  /** Blur handler for overlay editors (date picker / select): ignore the blur caused by opening the panel. */
  onOverlayBlur(editor: { overlayVisible?: boolean | null }): void {
    if (!editor.overlayVisible) this.commit();
  }

  private saveCell(row: Course, field: EditableField, value: Course[EditableField]): void {
    const previous: Partial<Course> = { [field]: row[field] };
    const patch: Partial<Course> = { [field]: value };
    if (field === 'publishStatusPkid') {
      previous.publishStatusDescription = row.publishStatusDescription;
      const status = this.publishStatuses().find((s) => s.pkid === value);
      if (status) patch.publishStatusDescription = status.description;
    }
    Object.assign(row, patch); // optimistic; reverted below on failure
    this.setSaving(row.pkid, true);

    // The list row lacks the long texts and n-n arrays, and PUT replaces everything,
    // so fetch the full record and change only the edited field.
    this.service
      .getById(row.pkid)
      .pipe(switchMap((full) => this.service.update(toCourseRequest(full, patch))))
      .subscribe({
        next: (saved) => {
          Object.assign(row, saved);
          this.setSaving(row.pkid, false);
          this.messages.add({
            severity: 'success',
            summary: '已儲存',
            detail: `課程「${saved.courseId}」${fieldLabel(field)}已更新`,
          });
        },
        error: (err: HttpErrorResponse) => {
          Object.assign(row, previous);
          this.setSaving(row.pkid, false);
          const detail =
            err.status === 409 || err.status === 400
              ? (err.error?.message ?? (err.status === 409 ? '簡介代碼已存在' : '資料驗證失敗'))
              : '儲存失敗';
          if (!isServerError(err)) this.messages.add({ severity: 'error', summary: '錯誤', detail });
        },
      });
  }

  private setSaving(pkid: number, saving: boolean): void {
    this.savingPkids.update((set) => {
      const next = new Set(set);
      if (saving) next.add(pkid);
      else next.delete(pkid);
      return next;
    });
  }

  private delete(course: Course): void {
    this.service.delete(course.pkid).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: '已刪除', detail: `課程「${course.courseId}」已刪除` });
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        const detail = err.status === 409 ? (err.error?.message ?? '使用中，無法刪除') : '刪除失敗';
        if (!isServerError(err)) this.messages.add({ severity: 'error', summary: '錯誤', detail });
      },
    });
  }

  private loadLookups(): void {
    if (this.lookupsLoaded) return;
    forkJoin({
      partners: this.lookups.getPartners(),
      courseGroups: this.lookups.getCourseGroups(),
      publishStatuses: this.lookups.getPublishStatuses(),
    }).subscribe({
      next: (r) => {
        this.partners.set(r.partners);
        this.courseGroups.set(r.courseGroups);
        this.publishStatuses.set(r.publishStatuses);
        this.lookupsLoaded = true;
      },
      error: (err: unknown) => {
        if (!isServerError(err)) this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入下拉選項' });
      },
    });
  }

  private toDraft(q: CourseQuery): DraftFilters {
    return {
      keyword: q.keyword ?? null,
      partnerPkid: q.partnerPkid ?? null,
      courseGroupPkid: q.courseGroupPkid ?? null,
      publishStatusPkid: q.publishStatusPkid ?? null,
      scheduleOnFrom: parseIsoDate(q.scheduleOnFrom),
      scheduleOnTo: parseIsoDate(q.scheduleOnTo),
      scheduleOffFrom: parseIsoDate(q.scheduleOffFrom),
      scheduleOffTo: parseIsoDate(q.scheduleOffTo),
      canRepeat: q.canRepeat ?? null,
    };
  }
}
