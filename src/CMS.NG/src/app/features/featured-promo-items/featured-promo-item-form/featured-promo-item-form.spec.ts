import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { PromotionLookup } from '../../../core/models/lookup.model';
import { LookupService } from '../../../core/services/lookup.service';
import { FeaturedPromoItem, PromoContent } from '../featured-promo-item.model';
import { FeaturedPromoItemService } from '../featured-promo-item.service';
import { FeaturedPromoItemForm } from './featured-promo-item-form';

describe('FeaturedPromoItemForm', () => {
  let fixture: ComponentFixture<FeaturedPromoItemForm>;
  let component: FeaturedPromoItemForm;
  let service: jasmine.SpyObj<FeaturedPromoItemService>;
  let lookups: jasmine.SpyObj<LookupService>;
  let messages: MessageService;

  const googleAi: PromotionLookup = {
    pkid: 102,
    promoCode: '251211_GoogleAI',
    topic: 'Google AI工具一次掌握',
    description: '不需技術基礎',
  };

  const existing: FeaturedPromoItem = {
    pkid: 1,
    scheduleOn: '2026-03-16',
    trainingCenterPkid: 1,
    trainingCenterName: '台北',
    slot: 1,
    promotionPkid: 101,
    promoCode: '20251204_SkillTrainAI',
    topic: '成為能AI協作的程式設計師',
    description: '轉職就業養成班',
  };

  function create(opts: { item?: FeaturedPromoItem; initial?: PromoContent } = {}): void {
    fixture = TestBed.createComponent(FeaturedPromoItemForm);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('scheduleOn', '2026-03-17');
    fixture.componentRef.setInput('trainingCenterPkid', 2);
    fixture.componentRef.setInput('slot', 3);
    if (opts.item) fixture.componentRef.setInput('item', opts.item);
    if (opts.initial) fixture.componentRef.setInput('initial', opts.initial);
    fixture.detectChanges();
  }

  const select = (p: PromotionLookup) => {
    component.form.controls.promotion.setValue(p);
    component.onSelect({ value: p } as AutoCompleteSelectEvent);
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<FeaturedPromoItemService>('FeaturedPromoItemService', ['create', 'update']);
    service.create.and.callFake((req) => of({ ...existing, ...req, pkid: 9, promoCode: googleAi.promoCode }));
    service.update.and.callFake((req) => of({ ...existing, ...req }));
    lookups = jasmine.createSpyObj<LookupService>('LookupService', ['searchPromotions']);
    lookups.searchPromotions.and.returnValue(of([googleAi]));

    await TestBed.configureTestingModule({
      imports: [FeaturedPromoItemForm],
      providers: [
        provideNoopAnimations(),
        MessageService,
        { provide: FeaturedPromoItemService, useValue: service },
        { provide: LookupService, useValue: lookups },
      ],
    }).compileComponents();

    messages = TestBed.inject(MessageService);
  });

  describe('new', () => {
    beforeEach(() => create());

    it('starts empty and requires a PromoCode, topic and description', () => {
      expect(component.isEdit()).toBeFalse();
      expect(component.form.getRawValue()).toEqual({ promotion: null, topic: '', description: '' });

      component.save();

      expect(component.form.controls.promotion.hasError('required')).toBeTrue();
      expect(component.form.controls.topic.hasError('required')).toBeTrue();
      expect(component.form.controls.description.hasError('required')).toBeTrue();
      expect(service.create).not.toHaveBeenCalled();
    });

    it('search() looks up promotions by the typed PromoCode', () => {
      component.search({ query: 'google', originalEvent: new Event('input') });
      expect(lookups.searchPromotions).toHaveBeenCalledOnceWith('google');
      expect(component.suggestions()).toEqual([googleAi]);
    });

    it('typed text that was not picked from the list is invalid', () => {
      component.form.patchValue({ promotion: '251211_Goo', topic: 't', description: 'd' });
      component.save();
      expect(component.form.controls.promotion.hasError('notSelected')).toBeTrue();
      expect(service.create).not.toHaveBeenCalled();
    });

    it('picking a PromoCode prefills topic and description', () => {
      select(googleAi);
      expect(component.form.controls.topic.value).toBe('Google AI工具一次掌握');
      expect(component.form.controls.description.value).toBe('不需技術基礎');
    });

    it('saves a new item for the row date / center / slot with the picked Promotion_pkid', () => {
      const saved = jasmine.createSpy('saved');
      component.saved.subscribe(saved);
      select(googleAi);
      component.form.patchValue({ topic: '  自訂主題 ' });

      component.save();

      expect(service.create).toHaveBeenCalledOnceWith({
        pkid: 0,
        scheduleOn: '2026-03-17',
        trainingCenterPkid: 2,
        slot: 3,
        promotionPkid: 102,
        topic: '自訂主題',
        description: '不需技術基礎',
      });
      expect(saved).toHaveBeenCalledWith(jasmine.objectContaining({ pkid: 9 }));
    });

    it('rejects over-long texts', () => {
      select(googleAi);
      component.form.patchValue({ topic: 'x'.repeat(101), description: 'y'.repeat(301) });
      component.save();
      expect(component.form.controls.topic.hasError('maxlength')).toBeTrue();
      expect(component.form.controls.description.hasError('maxlength')).toBeTrue();
      expect(service.create).not.toHaveBeenCalled();
    });

    it('shows the API message (e.g. 409 slot taken) and does not emit', () => {
      service.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { message: '2026-03-17 第 3 則已有上稿' } })),
      );
      const add = spyOn(messages, 'add');
      const saved = jasmine.createSpy('saved');
      component.saved.subscribe(saved);
      select(googleAi);

      component.save();

      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '2026-03-17 第 3 則已有上稿' }));
      expect(saved).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });

    it('cancel() emits cancelled', () => {
      const cancelled = jasmine.createSpy('cancelled');
      component.cancelled.subscribe(cancelled);
      component.cancel();
      expect(cancelled).toHaveBeenCalled();
    });
  });

  describe('paste', () => {
    it('prefills a new item with the copied content', () => {
      create({ initial: { promotionPkid: 102, promoCode: '251211_GoogleAI', topic: 'T', description: 'D' } });

      expect(component.isEdit()).toBeFalse();
      expect(component.form.getRawValue()).toEqual({
        promotion: { pkid: 102, promoCode: '251211_GoogleAI', topic: 'T', description: 'D' },
        topic: 'T',
        description: 'D',
      });
      component.save();
      expect(service.create).toHaveBeenCalledWith(jasmine.objectContaining({ pkid: 0, promotionPkid: 102, slot: 3 }));
    });
  });

  describe('edit', () => {
    beforeEach(() => create({ item: existing }));

    it('shows the existing values', () => {
      expect(component.isEdit()).toBeTrue();
      const v = component.form.getRawValue();
      expect((v.promotion as PromotionLookup).promoCode).toBe('20251204_SkillTrainAI');
      expect(v.topic).toBe('成為能AI協作的程式設計師');
      expect(v.description).toBe('轉職就業養成班');
    });

    it('updates with the item pkid and a newly picked promotion', () => {
      select(googleAi);
      component.save();

      expect(service.update).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ pkid: 1, promotionPkid: 102, topic: 'Google AI工具一次掌握' }),
      );
      expect(service.create).not.toHaveBeenCalled();
    });
  });
});
