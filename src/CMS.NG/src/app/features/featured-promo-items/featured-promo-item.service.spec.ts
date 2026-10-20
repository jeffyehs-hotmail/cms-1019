import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { FeaturedPromoItem, FeaturedPromoItemRequest } from './featured-promo-item.model';
import { FeaturedPromoItemService } from './featured-promo-item.service';

describe('FeaturedPromoItemService', () => {
  const baseUrl = `${environment.apiUrl}/featured-promo-items`;
  let service: FeaturedPromoItemService;
  let http: HttpTestingController;

  const item: FeaturedPromoItem = {
    pkid: 1,
    scheduleOn: '2026-03-16',
    trainingCenterPkid: 1,
    trainingCenterName: '台北',
    slot: 1,
    promotionPkid: 101,
    promoCode: '20251204_SkillTrainAI',
    topic: 'T',
    description: 'D',
  };

  const request: FeaturedPromoItemRequest = {
    pkid: 0,
    scheduleOn: '2026-03-17',
    trainingCenterPkid: 1,
    slot: 2,
    promotionPkid: 101,
    topic: 'T',
    description: 'D',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FeaturedPromoItemService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('query() POSTs the training center and week to /query', () => {
    const q = { trainingCenterPkid: 1, weekOf: '2026-03-16' };
    service.query(q).subscribe((rows) => expect(rows).toEqual([item]));
    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(q);
    req.flush([item]);
  });

  it('getById() GETs /{pkid}', () => {
    service.getById(1).subscribe((r) => expect(r).toEqual(item));
    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(item);
  });

  it('create() POSTs the request', () => {
    service.create(request).subscribe();
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(item);
  });

  it('update() PUTs the request', () => {
    service.update({ ...request, pkid: 1 }).subscribe();
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(1);
    req.flush(item);
  });

  it('delete() DELETEs /{pkid}', () => {
    service.delete(1).subscribe();
    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('moveUp() / moveDown() POST to the move endpoints', () => {
    service.moveUp(2).subscribe();
    service.moveDown(2).subscribe();
    const up = http.expectOne(`${baseUrl}/2/move-up`);
    const down = http.expectOne(`${baseUrl}/2/move-down`);
    expect(up.request.method).toBe('POST');
    expect(down.request.method).toBe('POST');
    up.flush(null, { status: 204, statusText: 'No Content' });
    down.flush(null, { status: 204, statusText: 'No Content' });
  });
});
