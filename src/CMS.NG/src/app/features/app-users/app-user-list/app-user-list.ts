import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService, SortEvent } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { AppRoleLookup } from '../../../core/models/lookup.model';
import { LookupService } from '../../../core/services/lookup.service';
import { readSession, writeSession } from '../../../core/utils/session-state';
import { AppUser, AppUserQuery } from '../app-user.model';
import { AppUserService } from '../app-user.service';

export const FILTERS_KEY = 'app-user-list-filters';
export const SORT_KEY = 'app-user-list-sort';
export const PAGE_KEY = 'app-user-list-page';

interface SortState {
  field: string;
  order: number;
}

interface PageState {
  first: number;
  rows: number;
}

const EMPTY_FILTERS: AppUserQuery = { keyword: null, isActive: null, roleId: null };

@Component({
  selector: 'app-app-user-list',
  imports: [
    DatePipe,
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
  templateUrl: './app-user-list.html',
  styleUrl: './app-user-list.scss',
})
export class AppUserList implements OnInit {
  private readonly service = inject(AppUserService);
  private readonly lookups = inject(LookupService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  /** Query param from the AppRole detail page (/app-users?roleId=Admin) — overrides saved filters. */
  readonly roleId = input<string>();

  readonly users = signal<AppUser[]>([]);
  readonly loading = signal(false);
  readonly filters = signal<AppUserQuery>(readSession(FILTERS_KEY, { ...EMPTY_FILTERS }));
  readonly activeFilterCount = computed(
    () => Object.values(this.filters()).filter((v) => v !== null && v !== undefined && v !== '').length,
  );

  readonly roles = signal<AppRoleLookup[]>([]);
  readonly roleOptions = computed(() =>
    this.roles().map((r) => ({ roleId: r.roleId, label: `${r.roleName} (${r.roleId})` })),
  );
  private lookupsLoaded = false;

  readonly isActiveOptions = [
    { label: '全部', value: null },
    { label: '啟用', value: true },
    { label: '停用', value: false },
  ];

  sort: SortState = readSession<SortState>(SORT_KEY, { field: 'userId', order: 1 });
  page: PageState = readSession<PageState>(PAGE_KEY, { first: 0, rows: 20 });

  drawerVisible = false;
  /** Editable copy of filters bound in the drawer; applied on 搜尋. */
  draft: AppUserQuery = { ...this.filters() };

  ngOnInit(): void {
    const roleId = this.roleId()?.trim();
    if (roleId) {
      this.filters.set({ ...EMPTY_FILTERS, roleId });
      writeSession(FILTERS_KEY, this.filters());
      this.onFirstChange(0);
    }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.query(this.filters()).subscribe({
      next: (rows) => {
        this.users.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入使用者資料' });
      },
    });
  }

  openFilters(): void {
    this.draft = { ...this.filters() };
    this.drawerVisible = true;
    this.loadLookups();
  }

  /** Role dropdown options are loaded the first time the drawer opens. */
  private loadLookups(): void {
    if (this.lookupsLoaded) return;
    this.lookupsLoaded = true;
    this.lookups.getAppRoles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: () => {
        this.lookupsLoaded = false;
        this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入角色選項' });
      },
    });
  }

  applyFilters(): void {
    const keyword = this.draft.keyword?.trim();
    this.filters.set({
      keyword: keyword ? keyword : null,
      isActive: this.draft.isActive ?? null,
      roleId: this.draft.roleId || null,
    });
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
    this.router.navigate(['/app-users/new']);
  }

  confirmDelete(user: AppUser): void {
    const roles = user.roleCount > 0 ? `，並移除 ${user.roleCount} 個角色指派` : '';
    this.confirmation.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${user.pkid}</b>「${user.userId} ${user.userName}」${roles}？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.delete(user),
    });
  }

  private delete(user: AppUser): void {
    this.service.delete(user.pkid).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: '已刪除', detail: `使用者「${user.userId}」已刪除` });
        this.load();
      },
      error: (err) =>
        this.messages.add({ severity: 'error', summary: '錯誤', detail: err?.error?.message ?? '刪除失敗' }),
    });
  }
}
