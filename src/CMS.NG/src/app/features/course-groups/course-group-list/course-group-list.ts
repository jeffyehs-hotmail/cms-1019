import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService, SortEvent } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { readSession, writeSession } from '../../../core/utils/session-state';
import { CourseGroup, CourseGroupQuery } from '../course-group.model';
import { CourseGroupService } from '../course-group.service';

export const FILTERS_KEY = 'course-group-list-filters';
export const SORT_KEY = 'course-group-list-sort';
export const PAGE_KEY = 'course-group-list-page';

interface SortState {
  field: string;
  order: number;
}

interface PageState {
  first: number;
  rows: number;
}

const EMPTY_FILTERS: CourseGroupQuery = { keyword: null };

/** True when any child table references the group (delete would be refused with 409). */
export function courseGroupInUse(g: CourseGroup): boolean {
  return g.courseCount + g.partnerCourseGroupCount > 0;
}

@Component({
  selector: 'app-course-group-list',
  imports: [FormsModule, RouterLink, ButtonModule, DrawerModule, InputTextModule, TableModule, TooltipModule, BadgeModule],
  templateUrl: './course-group-list.html',
  styleUrl: './course-group-list.scss',
})
export class CourseGroupList implements OnInit {
  private readonly service = inject(CourseGroupService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly courseGroups = signal<CourseGroup[]>([]);
  readonly loading = signal(false);
  readonly filters = signal<CourseGroupQuery>(readSession(FILTERS_KEY, { ...EMPTY_FILTERS }));
  readonly activeFilterCount = computed(
    () => Object.values(this.filters()).filter((v) => v !== null && v !== undefined && v !== '').length,
  );

  sort: SortState = readSession<SortState>(SORT_KEY, { field: 'pkid', order: -1 });
  page: PageState = readSession<PageState>(PAGE_KEY, { first: 0, rows: 20 });

  drawerVisible = false;
  /** Editable copy of filters bound in the drawer; applied on 搜尋. */
  draft: CourseGroupQuery = { ...this.filters() };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.query(this.filters()).subscribe({
      next: (rows) => {
        this.courseGroups.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入課程群組資料' });
      },
    });
  }

  inUse(group: CourseGroup): boolean {
    return courseGroupInUse(group);
  }

  openFilters(): void {
    this.draft = { ...this.filters() };
    this.drawerVisible = true;
  }

  applyFilters(): void {
    const keyword = this.draft.keyword?.trim();
    this.filters.set({ ...this.draft, keyword: keyword ? keyword : null });
    writeSession(FILTERS_KEY, this.filters());
    this.onFirstChange(0);
    this.drawerVisible = false;
    this.load();
  }

  clearFilters(): void {
    this.draft = { ...EMPTY_FILTERS };
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
    this.router.navigate(['/course-groups/new']);
  }

  confirmDelete(group: CourseGroup): void {
    if (this.inUse(group)) return;
    this.confirmation.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${group.pkid}</b>「${group.description}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.delete(group),
    });
  }

  private delete(group: CourseGroup): void {
    this.service.delete(group.pkid).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: '已刪除', detail: `課程群組「${group.description}」已刪除` });
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        const detail = err.status === 409 ? (err.error?.message ?? '使用中，無法刪除') : '刪除失敗';
        this.messages.add({ severity: 'error', summary: '錯誤', detail });
      },
    });
  }
}
