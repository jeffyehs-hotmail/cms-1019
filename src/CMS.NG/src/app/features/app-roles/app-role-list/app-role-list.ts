import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService, SortEvent } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { readSession, writeSession } from '../../../core/utils/session-state';
import { AppRole, AppRoleQuery } from '../app-role.model';
import { AppRoleService } from '../app-role.service';

export const FILTERS_KEY = 'app-role-list-filters';
export const SORT_KEY = 'app-role-list-sort';
export const PAGE_KEY = 'app-role-list-page';

interface SortState {
  field: string;
  order: number;
}

interface PageState {
  first: number;
  rows: number;
}

const EMPTY_FILTERS: AppRoleQuery = { keyword: null, permissionLevelFrom: null, permissionLevelTo: null };

@Component({
  selector: 'app-app-role-list',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DrawerModule,
    InputNumberModule,
    InputTextModule,
    TableModule,
    TooltipModule,
    BadgeModule,
  ],
  templateUrl: './app-role-list.html',
  styleUrl: './app-role-list.scss',
})
export class AppRoleList implements OnInit {
  private readonly service = inject(AppRoleService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly roles = signal<AppRole[]>([]);
  readonly loading = signal(false);
  readonly filters = signal<AppRoleQuery>(readSession(FILTERS_KEY, { ...EMPTY_FILTERS }));
  readonly activeFilterCount = computed(
    () => Object.values(this.filters()).filter((v) => v !== null && v !== undefined && v !== '').length,
  );

  sort: SortState = readSession<SortState>(SORT_KEY, { field: 'roleId', order: 1 });
  page: PageState = readSession<PageState>(PAGE_KEY, { first: 0, rows: 20 });

  drawerVisible = false;
  /** Editable copy of filters bound in the drawer; applied on 搜尋. */
  draft: AppRoleQuery = { ...this.filters() };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.query(this.filters()).subscribe({
      next: (rows) => {
        this.roles.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入角色資料' });
      },
    });
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
    this.router.navigate(['/app-roles/new']);
  }

  confirmDelete(role: AppRole): void {
    this.confirmation.confirm({
      header: '刪除確認',
      message:
        role.userCount > 0
          ? `角色「${role.roleId}」目前有 ${role.userCount} 位使用者，刪除後將一併移除指派。確定要刪除嗎？`
          : `確定要刪除角色「${role.roleId}」嗎？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.delete(role),
    });
  }

  private delete(role: AppRole): void {
    this.service.delete(role.pkid).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: '已刪除', detail: `角色「${role.roleId}」已刪除` });
        this.load();
      },
      error: () => this.messages.add({ severity: 'error', summary: '錯誤', detail: '刪除失敗' }),
    });
  }
}
