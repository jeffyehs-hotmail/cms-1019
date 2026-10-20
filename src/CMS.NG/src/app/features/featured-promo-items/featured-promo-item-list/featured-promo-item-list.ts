import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import { TrainingCenterLookup } from '../../../core/models/lookup.model';
import { LookupService } from '../../../core/services/lookup.service';
import { addDays, parseIsoDate, startOfWeek, toIsoDate } from '../../../core/utils/date.util';
import { readSession, writeSession } from '../../../core/utils/session-state';
import { FeaturedPromoItemForm } from '../featured-promo-item-form/featured-promo-item-form';
import { FeaturedPromoItem, MAX_SLOT, PromoContent } from '../featured-promo-item.model';
import { FeaturedPromoItemService } from '../featured-promo-item.service';

export const FILTERS_KEY = 'featured-promo-item-list-filters';

interface Filters {
  trainingCenterPkid: number | null;
  /** Monday of the shown week, `yyyy-MM-dd`; null = this week. */
  weekOf: string | null;
}

export interface SlotRow {
  slot: number;
  item: FeaturedPromoItem | null;
}

export interface DayGroup {
  iso: string;
  label: string;
  slots: SlotRow[];
}

/** The slot whose inline editor is open. `initial` holds pasted content for a new item. */
interface Editing {
  iso: string;
  slot: number;
  initial: PromoContent | null;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const SLOTS = Array.from({ length: MAX_SLOT }, (_, i) => i + 1);

const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

@Component({
  selector: 'app-featured-promo-item-list',
  imports: [ButtonModule, TabsModule, TooltipModule, FeaturedPromoItemForm],
  templateUrl: './featured-promo-item-list.html',
  styleUrl: './featured-promo-item-list.scss',
})
export class FeaturedPromoItemList implements OnInit {
  private readonly service = inject(FeaturedPromoItemService);
  private readonly lookups = inject(LookupService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly maxSlot = MAX_SLOT;
  readonly centers = signal<TrainingCenterLookup[]>([]);
  readonly centerPkid = signal<number | null>(null);
  readonly weekStart = signal<Date>(startOfWeek(new Date()));
  readonly items = signal<FeaturedPromoItem[]>([]);
  readonly loading = signal(false);
  readonly editing = signal<Editing | null>(null);
  /** Content from the last Copy, available to Paste into an empty slot (any day / center). */
  readonly clipboard = signal<PromoContent | null>(null);

  readonly weekLabel = computed(() => `${md(this.weekStart())} -- ${md(addDays(this.weekStart(), 6))}`);

  readonly days = computed<DayGroup[]>(() => {
    const items = this.items();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(this.weekStart(), i);
      const iso = toIsoDate(d);
      return {
        iso,
        label: `${md(d)} (${WEEKDAYS[d.getDay()]})`,
        slots: SLOTS.map((slot) => ({
          slot,
          item: items.find((x) => x.scheduleOn.startsWith(iso) && x.slot === slot) ?? null,
        })),
      };
    });
  });

  ngOnInit(): void {
    const saved = readSession<Filters>(FILTERS_KEY, { trainingCenterPkid: null, weekOf: null });
    const savedWeek = parseIsoDate(saved.weekOf);
    if (savedWeek) this.weekStart.set(startOfWeek(savedWeek));

    this.lookups.getTrainingCenters().subscribe({
      next: (centers) => {
        this.centers.set(centers);
        const keep = centers.some((c) => c.pkid === saved.trainingCenterPkid);
        this.centerPkid.set(keep ? saved.trainingCenterPkid : (centers[0]?.pkid ?? null));
        this.load();
      },
      error: () => this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入訓練中心' }),
    });
  }

  load(): void {
    const center = this.centerPkid();
    if (center === null) return;
    writeSession(FILTERS_KEY, { trainingCenterPkid: center, weekOf: toIsoDate(this.weekStart()) });

    this.loading.set(true);
    this.service.query({ trainingCenterPkid: center, weekOf: toIsoDate(this.weekStart()) }).subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入上稿資料' });
      },
    });
  }

  selectCenter(value: string | number | undefined): void {
    const pkid = Number(value);
    if (!pkid || pkid === this.centerPkid()) return;
    this.centerPkid.set(pkid);
    this.editing.set(null);
    this.load();
  }

  shiftWeek(weeks: number): void {
    this.weekStart.set(addDays(this.weekStart(), weeks * 7));
    this.editing.set(null);
    this.load();
  }

  thisWeek(): void {
    this.weekStart.set(startOfWeek(new Date()));
    this.editing.set(null);
    this.load();
  }

  isEditing(day: DayGroup, row: SlotRow): boolean {
    const e = this.editing();
    return !!e && e.iso === day.iso && e.slot === row.slot;
  }

  /** Opens the inline editor: Edit for a filled slot, New for an empty one. */
  edit(day: DayGroup, row: SlotRow): void {
    this.editing.set({ iso: day.iso, slot: row.slot, initial: null });
  }

  /** New item in an empty slot, prefilled with the copied content. */
  paste(day: DayGroup, row: SlotRow): void {
    const content = this.clipboard();
    if (!content || row.item) return;
    this.editing.set({ iso: day.iso, slot: row.slot, initial: { ...content } });
  }

  copy(item: FeaturedPromoItem): void {
    this.clipboard.set({
      promotionPkid: item.promotionPkid,
      promoCode: item.promoCode,
      topic: item.topic,
      description: item.description,
    });
    this.messages.add({ severity: 'info', summary: '已複製', detail: `${item.promoCode}，可貼到空白欄位` });
  }

  onSaved(item: FeaturedPromoItem): void {
    this.editing.set(null);
    this.messages.add({ severity: 'success', summary: '已儲存', detail: `${item.scheduleOn} 第 ${item.slot} 則已儲存` });
    this.load();
  }

  onCancelled(): void {
    this.editing.set(null);
  }

  /** "+" moves the item down a slot (1 → 2); "−" moves it up (2 → 1). Neighbors swap. */
  move(item: FeaturedPromoItem, direction: 'up' | 'down'): void {
    if ((direction === 'up' && item.slot <= 1) || (direction === 'down' && item.slot >= MAX_SLOT)) return;
    const call: Observable<void> =
      direction === 'up' ? this.service.moveUp(item.pkid) : this.service.moveDown(item.pkid);
    call.subscribe({
      next: () => this.load(),
      error: (err: HttpErrorResponse) =>
        this.messages.add({ severity: 'error', summary: '錯誤', detail: err.error?.message ?? '移動失敗' }),
    });
  }

  confirmDelete(item: FeaturedPromoItem): void {
    this.confirmation.confirm({
      header: '刪除確認',
      message: `確定要刪除 ${item.scheduleOn} 第 <b>${item.slot}</b> 則「${item.promoCode}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.delete(item),
    });
  }

  private delete(item: FeaturedPromoItem): void {
    this.service.delete(item.pkid).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: '已刪除', detail: `${item.scheduleOn} 第 ${item.slot} 則已刪除` });
        this.load();
      },
      error: () => this.messages.add({ severity: 'error', summary: '錯誤', detail: '刪除失敗' }),
    });
  }
}
