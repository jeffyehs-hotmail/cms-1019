import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { AutoCompleteCompleteEvent, AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PromotionLookup } from '../../../core/models/lookup.model';
import { LookupService } from '../../../core/services/lookup.service';
import { FeaturedPromoItem, FeaturedPromoItemRequest, PromoContent } from '../featured-promo-item.model';
import { FeaturedPromoItemService } from '../featured-promo-item.service';
import { isServerError } from '../../../core/utils/server-error';

/** At least one non-whitespace character. */
const NOT_BLANK = Validators.pattern(/\S/);

/** The PromoCode box holds typed text until a suggestion is picked; only a picked promotion is valid. */
function promotionSelected(c: AbstractControl): ValidationErrors | null {
  const v = c.value as PromotionLookup | string | null;
  if (v === null || v === '') return { required: true };
  return typeof v === 'object' && v.pkid > 0 ? null : { notSelected: true };
}

/**
 * Inline editor for one slot (Edit when `item` is set; New otherwise, optionally prefilled from Paste).
 * Date / training center / slot come from the grid row and are not editable here.
 */
@Component({
  selector: 'app-featured-promo-item-form',
  imports: [ReactiveFormsModule, AutoCompleteModule, ButtonModule, InputTextModule],
  templateUrl: './featured-promo-item-form.html',
  styleUrl: './featured-promo-item-form.scss',
})
export class FeaturedPromoItemForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(FeaturedPromoItemService);
  private readonly lookups = inject(LookupService);
  private readonly messages = inject(MessageService);

  /** Existing item (Edit); null for New. */
  readonly item = input<FeaturedPromoItem | null>(null);
  /** Prefill for New (from Paste). */
  readonly initial = input<PromoContent | null>(null);
  readonly scheduleOn = input.required<string>();
  readonly trainingCenterPkid = input.required<number>();
  readonly slot = input.required<number>();

  readonly saved = output<FeaturedPromoItem>();
  readonly cancelled = output<void>();

  readonly isEdit = computed(() => !!this.item());
  readonly suggestions = signal<PromotionLookup[]>([]);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    promotion: this.fb.control<PromotionLookup | string | null>(null, promotionSelected),
    topic: ['', [Validators.required, Validators.maxLength(100), NOT_BLANK]],
    description: ['', [Validators.required, Validators.maxLength(300), NOT_BLANK]],
  });

  ngOnInit(): void {
    const source: PromoContent | null = this.item() ?? this.initial();
    if (source) {
      this.form.patchValue({
        promotion: {
          pkid: source.promotionPkid,
          promoCode: source.promoCode,
          topic: source.topic,
          description: source.description,
        },
        topic: source.topic,
        description: source.description,
      });
    }
  }

  search(event: AutoCompleteCompleteEvent): void {
    this.lookups.searchPromotions(event.query).subscribe({
      next: (rows) => this.suggestions.set(rows),
      error: () => this.suggestions.set([]),
    });
  }

  /** Picking a PromoCode sets Promotion_pkid and prefills Topic / Description from Promotion2. */
  onSelect(event: AutoCompleteSelectEvent): void {
    const p = event.value as PromotionLookup;
    this.form.patchValue({ topic: p.topic, description: p.description });
  }

  showError(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const promotion = v.promotion as PromotionLookup;
    const request: FeaturedPromoItemRequest = {
      pkid: this.item()?.pkid ?? 0,
      scheduleOn: this.scheduleOn(),
      trainingCenterPkid: this.trainingCenterPkid(),
      slot: this.slot(),
      promotionPkid: promotion.pkid,
      topic: (v.topic ?? '').trim(),
      description: (v.description ?? '').trim(),
    };

    this.saving.set(true);
    const call = this.isEdit() ? this.service.update(request) : this.service.create(request);
    call.subscribe({
      next: (item) => {
        this.saving.set(false);
        this.saved.emit(item);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        if (!isServerError(err)) {
          this.messages.add({ severity: 'error', summary: '錯誤', detail: err.error?.message ?? '儲存失敗' });
        }
      },
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
