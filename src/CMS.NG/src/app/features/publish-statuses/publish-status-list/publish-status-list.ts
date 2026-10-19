import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService, SortEvent } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { readSession, writeSession } from '../../../core/utils/session-state';
import { PublishStatus, PublishStatusQuery } from '../publish-status.model';
import { PublishStatusService } from '../publish-status.service';

export const FILTERS_KEY = 'publish-status-list-filters';
export const SORT_KEY = 'publish-status-list-sort';
export const PAGE_KEY = 'publish-status-list-page';

interface SortState {
  field: string;
  order: number;
}

interface PageState {
  first: number;
  rows: number;
}

const EMPTY_FILTERS: PublishStatusQuery = { keyword: null, isDraft: null, isPublished: null, isDiscontinued: null };

/** Tri-state options for bool filters: null = 全部 (no filter). */
export const BOOL_OPTIONS = [
  { label: '全部', value: null },
  { label: '是', value: true },
  { label: '否', value: false },
];

@Component({
  selector: 'app-publish-status-list',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DrawerModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TooltipModule,
    BadgeModule,
  ],
  templateUrl: './publish-status-list.html',
  styleUrl: './publish-status-list.scss',
})
export class PublishStatusList implements OnInit {
  private readonly service = inject(PublishStatusService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly boolOptions = BOOL_OPTIONS;
  readonly statuses = signal<PublishStatus[]>([]);
  readonly loading = signal(false);
  readonly filters = signal<PublishStatusQuery>(readSession(FILTERS_KEY, { ...EMPTY_FILTERS }));
  readonly activeFilterCount = computed(
    () => Object.values(this.filters()).filter((v) => v !== null && v !== undefined && v !== '').length,
  );

  sort: SortState = readSession<SortState>(SORT_KEY, { field: 'pkid', order: 1 });
  page: PageState = readSession<PageState>(PAGE_KEY, { first: 0, rows: 20 });

  drawerVisible = false;
  /** Editable copy of filters bound in the drawer; applied on 搜尋. */
  draft: PublishStatusQuery = { ...this.filters() };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.query(this.filters()).subscribe({
      next: (rows) => {
        this.statuses.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入發布狀態資料' });
      },
    });
  }

  inUse(status: PublishStatus): boolean {
    return status.courseCount + status.promotion2Count > 0;
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
    this.router.navigate(['/publish-statuses/new']);
  }

  confirmDelete(status: PublishStatus): void {
    if (this.inUse(status)) return;
    this.confirmation.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${status.pkid}</b>「${status.description}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.delete(status),
    });
  }

  private delete(status: PublishStatus): void {
    this.service.delete(status.pkid).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: '已刪除', detail: `發布狀態「${status.description}」已刪除` });
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        const detail = err.status === 409 ? (err.error?.message ?? '使用中，無法刪除') : '刪除失敗';
        this.messages.add({ severity: 'error', summary: '錯誤', detail });
      },
    });
  }
}
