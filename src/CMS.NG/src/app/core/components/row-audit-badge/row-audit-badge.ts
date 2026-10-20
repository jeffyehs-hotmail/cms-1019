import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { RowAuditEntry, RowAuditService } from './row-audit.service';

/**
 * 異動紀錄 History badge for a page toolbar: shows the record's latest RowAudit row inline and opens a dialog with
 * the full trail (newest first). Reloads whenever `tableName` / `pkid` change and each time the dialog opens.
 */
@Component({
  selector: 'app-row-audit-badge',
  imports: [DatePipe, DialogModule, TableModule],
  templateUrl: './row-audit-badge.html',
  styleUrl: './row-audit-badge.scss',
})
export class RowAuditBadge {
  private readonly service = inject(RowAuditService);

  /** RowAudit.TableName, i.e. the real table name (e.g. 'Course'). */
  readonly tableName = input.required<string>();
  /** The record's pkid (RowAudit.PrimaryKeyValues). */
  readonly pkid = input.required<string | number>();

  /** Null while the first load is pending. */
  readonly rows = signal<RowAuditEntry[] | null>(null);
  readonly failed = signal(false);
  readonly latest = computed(() => this.rows()?.[0] ?? null);
  readonly dialogVisible = signal(false);

  constructor() {
    effect((onCleanup) => {
      const tableName = this.tableName();
      const pkid = this.pkid();
      untracked(() => this.rows.set(null));
      const sub = this.service.getHistory(tableName, pkid).subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.failed.set(false);
        },
        error: () => this.failed.set(true),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  open(): void {
    this.dialogVisible.set(true);
    this.service.getHistory(this.tableName(), this.pkid()).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.failed.set(false);
      },
      error: () => this.failed.set(true),
    });
  }
}
