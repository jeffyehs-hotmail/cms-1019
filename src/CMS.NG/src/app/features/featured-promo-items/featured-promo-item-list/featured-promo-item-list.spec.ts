import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { LookupService } from '../../../core/services/lookup.service';
import { startOfWeek, toIsoDate } from '../../../core/utils/date.util';
import { FeaturedPromoItem } from '../featured-promo-item.model';
import { FeaturedPromoItemService } from '../featured-promo-item.service';
import { DayGroup, FILTERS_KEY, FeaturedPromoItemList } from './featured-promo-item-list';

describe('FeaturedPromoItemList', () => {
  let fixture: ComponentFixture<FeaturedPromoItemList>;
  let component: FeaturedPromoItemList;
  let service: jasmine.SpyObj<FeaturedPromoItemService>;
  let lookups: jasmine.SpyObj<LookupService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  const centers = [
    { pkid: 1, name: '台北' },
    { pkid: 2, name: '新竹' },
    { pkid: 54, name: '線上研討會' },
  ];

  const base: FeaturedPromoItem = {
    pkid: 0,
    scheduleOn: '2026-03-16',
    trainingCenterPkid: 1,
    trainingCenterName: '台北',
    slot: 1,
    promotionPkid: 101,
    promoCode: '20251204_SkillTrainAI',
    topic: '成為能AI協作的程式設計師',
    description: '轉職就業養成班',
  };
  const monSlot1: FeaturedPromoItem = { ...base, pkid: 1 };
  const monSlot2: FeaturedPromoItem = { ...base, pkid: 2, slot: 2, promotionPkid: 102, promoCode: '251211_GoogleAI' };
  const wedSlot3: FeaturedPromoItem = { ...base, pkid: 3, scheduleOn: '2026-03-18', slot: 3 };
  const rows = [monSlot1, monSlot2, wedSlot3];

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(FeaturedPromoItemList);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const day = (iso: string) => component.days().find((d) => d.iso === iso)!;
  const row = (d: DayGroup, slot: number) => d.slots.find((s) => s.slot === slot)!;

  beforeEach(async () => {
    sessionStorage.clear();
    // Start on the week of Mon 2026-03-16.
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ trainingCenterPkid: null, weekOf: '2026-03-18' }));

    service = jasmine.createSpyObj<FeaturedPromoItemService>('FeaturedPromoItemService', [
      'query',
      'delete',
      'moveUp',
      'moveDown',
      'create',
      'update',
    ]);
    service.query.and.callFake(() => of([...rows]));
    service.delete.and.returnValue(of(undefined));
    service.moveUp.and.returnValue(of(undefined));
    service.moveDown.and.returnValue(of(undefined));
    lookups = jasmine.createSpyObj<LookupService>('LookupService', ['getTrainingCenters', 'searchPromotions']);
    lookups.getTrainingCenters.and.returnValue(of(centers));
    lookups.searchPromotions.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [FeaturedPromoItemList],
      providers: [
        provideNoopAnimations(),
        ConfirmationService,
        MessageService,
        { provide: FeaturedPromoItemService, useValue: service },
        { provide: LookupService, useValue: lookups },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => sessionStorage.clear());

  // ---------- Training center tabs ----------

  it('renders a tab per training center and queries the first one', async () => {
    await create();

    const tabs = el().querySelectorAll('p-tab');
    expect(Array.from(tabs).map((t) => t.textContent?.trim())).toEqual(['台北', '新竹', '線上研討會']);
    expect(component.centerPkid()).toBe(1);
    expect(service.query).toHaveBeenCalledOnceWith({ trainingCenterPkid: 1, weekOf: '2026-03-16' });
  });

  it('selecting a tab filters by that training center', async () => {
    await create();
    service.query.calls.reset();

    component.selectCenter(54);

    expect(component.centerPkid()).toBe(54);
    expect(service.query).toHaveBeenCalledOnceWith({ trainingCenterPkid: 54, weekOf: '2026-03-16' });
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).trainingCenterPkid).toBe(54);
  });

  it('restores the saved center, but falls back to the first if it no longer exists', async () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ trainingCenterPkid: 2, weekOf: '2026-03-16' }));
    await create();
    expect(component.centerPkid()).toBe(2);

    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ trainingCenterPkid: 99, weekOf: '2026-03-16' }));
    await create();
    expect(component.centerPkid()).toBe(1);
  });

  // ---------- One-week (Monday–Sunday) navigation ----------

  it('shows Monday to Sunday of the saved week with weekday labels', async () => {
    await create();

    expect(el().querySelector('[data-week]')?.textContent?.trim()).toBe('3/16 -- 3/22');
    const days = component.days();
    expect(days.map((d) => d.iso)).toEqual([
      '2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20', '2026-03-21', '2026-03-22',
    ]);
    expect(days[0].label).toBe('3/16 (一)');
    expect(days[6].label).toBe('3/22 (日)');
    expect(el().querySelectorAll('section.day').length).toBe(7);
  });

  it('shiftWeek() moves by 7 days and re-queries', async () => {
    await create();
    service.query.calls.reset();

    component.shiftWeek(1);
    expect(component.weekLabel()).toBe('3/23 -- 3/29');
    expect(service.query).toHaveBeenCalledOnceWith({ trainingCenterPkid: 1, weekOf: '2026-03-23' });

    component.shiftWeek(-2);
    expect(component.weekLabel()).toBe('3/9 -- 3/15');
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).weekOf).toBe('2026-03-09');
  });

  it('thisWeek() jumps to the Monday of today', async () => {
    await create();
    component.thisWeek();
    expect(toIsoDate(component.weekStart())).toBe(toIsoDate(startOfWeek(new Date())));
  });

  it('defaults to the current week when nothing is saved', async () => {
    sessionStorage.clear();
    await create();
    expect(service.query).toHaveBeenCalledOnceWith({ trainingCenterPkid: 1, weekOf: toIsoDate(startOfWeek(new Date())) });
  });

  // ---------- Grid ----------

  it('places items by date and slot, with 3 slots per day', async () => {
    await create();

    const monday = day('2026-03-16');
    expect(monday.slots.map((s) => s.item?.pkid ?? null)).toEqual([1, 2, null]);
    expect(day('2026-03-18').slots.map((s) => s.item?.pkid ?? null)).toEqual([null, null, 3]);

    const firstRow = el().querySelector('[data-day="2026-03-16"] [data-slot="1"]')!;
    expect(firstRow.querySelector('[data-col="promoCode"]')?.textContent?.trim()).toBe('20251204_SkillTrainAI');
    expect(firstRow.querySelector('[data-col="topic"]')?.textContent?.trim()).toBe('成為能AI協作的程式設計師');
    expect(firstRow.querySelector('[data-col="description"]')?.textContent?.trim()).toBe('轉職就業養成班');
  });

  it('filled rows offer Copy / Delete, empty rows offer Paste', async () => {
    await create();
    const filled = el().querySelector('[data-day="2026-03-16"] [data-slot="1"]')!;
    const empty = el().querySelector('[data-day="2026-03-16"] [data-slot="3"]')!;

    expect(filled.querySelector('[data-action="copy"]')).not.toBeNull();
    expect(filled.querySelector('[data-action="delete"]')).not.toBeNull();
    expect(filled.querySelector('[data-action="paste"]')).toBeNull();
    expect(empty.querySelector('[data-action="paste"]')).not.toBeNull();
    expect(empty.querySelector('[data-action="copy"]')).toBeNull();
  });

  // ---------- Edit / New / Copy / Paste ----------

  it('edit() opens the inline form with the existing item', async () => {
    await create();
    component.edit(day('2026-03-16'), row(day('2026-03-16'), 2));
    fixture.detectChanges();

    const form = el().querySelector('[data-day="2026-03-16"] [data-slot="2"] app-featured-promo-item-form');
    expect(form).not.toBeNull();
    expect(component.isEditing(day('2026-03-16'), row(day('2026-03-16'), 2))).toBeTrue();
    expect(el().querySelectorAll('app-featured-promo-item-form').length).toBe(1);
  });

  it('edit() on an empty slot opens an empty New form', async () => {
    await create();
    component.edit(day('2026-03-17'), row(day('2026-03-17'), 1));
    fixture.detectChanges();

    expect(component.editing()).toEqual({ iso: '2026-03-17', slot: 1, initial: null });
    expect(el().querySelector('[data-day="2026-03-17"] [data-slot="1"] app-featured-promo-item-form')).not.toBeNull();
  });

  it('copy() then paste() opens a New form prefilled with the copied content', async () => {
    await create();
    expect(component.clipboard()).toBeNull();

    component.copy(monSlot2);
    component.paste(day('2026-03-20'), row(day('2026-03-20'), 3));

    const expected = { promotionPkid: 102, promoCode: '251211_GoogleAI', topic: base.topic, description: base.description };
    expect(component.clipboard()).toEqual(expected);
    expect(component.editing()).toEqual({ iso: '2026-03-20', slot: 3, initial: expected });
    fixture.detectChanges();
    expect(el().querySelector('[data-clipboard]')?.textContent).toContain('251211_GoogleAI');
  });

  it('paste() does nothing without a copy or on a filled slot', async () => {
    await create();
    component.paste(day('2026-03-20'), row(day('2026-03-20'), 1));
    expect(component.editing()).toBeNull();

    component.copy(monSlot1);
    component.paste(day('2026-03-16'), row(day('2026-03-16'), 1));
    expect(component.editing()).toBeNull();
  });

  it('onSaved() closes the editor and reloads; onCancelled() just closes it', async () => {
    await create();
    component.edit(day('2026-03-16'), row(day('2026-03-16'), 1));
    service.query.calls.reset();

    component.onSaved(monSlot1);
    expect(component.editing()).toBeNull();
    expect(service.query).toHaveBeenCalledTimes(1);

    component.edit(day('2026-03-16'), row(day('2026-03-16'), 1));
    component.onCancelled();
    expect(component.editing()).toBeNull();
    expect(service.query).toHaveBeenCalledTimes(1);
  });

  it('changing week or tab closes an open editor', async () => {
    await create();
    component.edit(day('2026-03-16'), row(day('2026-03-16'), 1));
    component.shiftWeek(1);
    expect(component.editing()).toBeNull();
  });

  // ---------- + / − ----------

  it('+ moves the item down and − moves it up, then reloads', async () => {
    await create();
    service.query.calls.reset();

    component.move(monSlot1, 'down');
    component.move(monSlot2, 'up');

    expect(service.moveDown).toHaveBeenCalledOnceWith(1);
    expect(service.moveUp).toHaveBeenCalledOnceWith(2);
    expect(service.query).toHaveBeenCalledTimes(2);
  });

  it('does not move past the first or last slot', async () => {
    await create();
    component.move(monSlot1, 'up');
    component.move(wedSlot3, 'down');
    expect(service.moveUp).not.toHaveBeenCalled();
    expect(service.moveDown).not.toHaveBeenCalled();
  });

  it('shows the API message when a move fails', async () => {
    service.moveDown.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { message: '已是最後一則，無法下移' } })));
    await create();
    const add = spyOn(messages, 'add');
    component.move(monSlot2, 'down');
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '已是最後一則，無法下移' }));
  });

  // ---------- Delete ----------

  it('confirmDelete() deletes the selected record after confirmation and reloads', async () => {
    await create();
    let message = '';
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      message = c.message ?? '';
      c.accept?.();
      return confirmation;
    });
    service.query.calls.reset();

    component.confirmDelete(monSlot2);

    expect(message).toContain('251211_GoogleAI');
    expect(service.delete).toHaveBeenCalledOnceWith(2);
    expect(service.query).toHaveBeenCalledTimes(1);
  });

  it('confirmDelete() does nothing when rejected', async () => {
    await create();
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.reject?.();
      return confirmation;
    });
    component.confirmDelete(monSlot1);
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('shows an error toast when loading fails', async () => {
    service.query.and.returnValue(throwError(() => new Error('boom')));
    const add = spyOn(TestBed.inject(MessageService), 'add');
    await create();
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(component.loading()).toBeFalse();
  });
});
