import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { AppUserLookup } from '../../../core/models/lookup.model';
import { LookupService } from '../../../core/services/lookup.service';
import { parseIsoDate, toIsoDate } from '../../../core/utils/date.util';
import { readSession, writeSession } from '../../../core/utils/session-state';
import {
  AgentTokenUsage,
  AgentTokenUsageQuery,
  cacheWriteTokens,
  currentTaipeiMonth,
  tokenInTokens,
  totalsOf,
} from '../agent-token-usage.model';
import { AgentTokenUsageService } from '../agent-token-usage.service';

export const FILTERS_KEY = 'agent-token-usage-report-filters';

interface Draft {
  range: Date[] | null;
  userIds: string[];
  projects: string[];
  models: string[];
}

@Component({
  selector: 'app-agent-token-usage-report',
  imports: [DecimalPipe, FormsModule, ButtonModule, DatePickerModule, MultiSelectModule, TableModule, TagModule],
  templateUrl: './agent-token-usage-report.html',
  styleUrl: './agent-token-usage-report.scss',
})
export class AgentTokenUsageReport implements OnInit {
  private readonly service = inject(AgentTokenUsageService);
  private readonly lookups = inject(LookupService);
  private readonly messages = inject(MessageService);

  readonly rows = signal<AgentTokenUsage[]>([]);
  readonly loading = signal(false);
  readonly filters = signal<AgentTokenUsageQuery>(readSession(FILTERS_KEY, this.defaultFilters()));
  readonly totals = computed(() => totalsOf(this.rows()));

  readonly users = signal<AppUserLookup[]>([]);
  readonly userOptions = computed(() => this.users().map((u) => ({ value: u.userId, label: `${u.userName} (${u.userId})` })));
  readonly projects = signal<string[]>([]);
  readonly models = signal<string[]>([]);

  /** Filter bar values; applied on 搜尋. */
  draft: Draft = this.toDraft(this.filters());

  readonly cacheWrite = cacheWriteTokens;
  readonly tokenIn = tokenInTokens;

  ngOnInit(): void {
    this.loadOptions();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.query(this.filters()).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.messages.add({ severity: 'error', summary: '錯誤', detail: err?.error?.message ?? '無法載入 Token 用量' });
      },
    });
  }

  private loadOptions(): void {
    forkJoin({ users: this.lookups.getAppUsers(), options: this.service.getFilterOptions() }).subscribe({
      next: ({ users, options }) => {
        this.users.set(users);
        this.projects.set(options.projects);
        this.models.set(options.models);
      },
      error: () => this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入篩選選項' }),
    });
  }

  search(): void {
    const [from, to] = this.draft.range ?? [];
    if (!from) {
      this.messages.add({ severity: 'warn', summary: '請選擇日期', detail: '請選擇日期區間' });
      return;
    }
    this.filters.set({
      from: toIsoDate(from),
      to: toIsoDate(to ?? from),
      userIds: [...this.draft.userIds],
      projects: [...this.draft.projects],
      models: [...this.draft.models],
    });
    writeSession(FILTERS_KEY, this.filters());
    this.load();
  }

  reset(): void {
    this.draft = this.toDraft(this.defaultFilters());
    this.search();
  }

  private defaultFilters(): AgentTokenUsageQuery {
    const { from, to } = currentTaipeiMonth();
    return { from: toIsoDate(from), to: toIsoDate(to), userIds: [], projects: [], models: [] };
  }

  private toDraft(q: AgentTokenUsageQuery): Draft {
    const from = parseIsoDate(q.from);
    const to = parseIsoDate(q.to);
    return {
      range: from ? [from, to ?? from] : null,
      userIds: [...q.userIds],
      projects: [...q.projects],
      models: [...q.models],
    };
  }
}
