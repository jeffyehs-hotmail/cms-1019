import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ConfirmationService, MessageService, SortEvent } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CourseGroupLookup, PartnerLookup, PublishStatusLookup } from '../../../core/models/lookup.model';
import { LookupService } from '../../../core/services/lookup.service';
import { parseIsoDate, toIsoDate } from '../../../core/utils/date.util';
import { readSession, writeSession } from '../../../core/utils/session-state';
import { Course, CourseQuery, courseInUse } from '../course.model';
import { CourseService } from '../course.service';

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
    FormsModule,
    RouterLink,
    ButtonModule,
    DatePickerModule,
    DrawerModule,
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
    this.service.query(this.filters()).subscribe({
      next: (rows) => {
        this.courses.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入課程資料' });
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

  private delete(course: Course): void {
    this.service.delete(course.pkid).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: '已刪除', detail: `課程「${course.courseId}」已刪除` });
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        const detail = err.status === 409 ? (err.error?.message ?? '使用中，無法刪除') : '刪除失敗';
        this.messages.add({ severity: 'error', summary: '錯誤', detail });
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
      error: () => this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入下拉選項' }),
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
