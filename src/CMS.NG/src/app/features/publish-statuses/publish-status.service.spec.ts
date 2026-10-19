import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { PublishStatus, PublishStatusRequest } from './publish-status.model';
import { PublishStatusService } from './publish-status.service';

describe('PublishStatusService', () => {
  const baseUrl = `${environment.apiUrl}/publish-statuses`;
  let service: PublishStatusService;
  let http: HttpTestingController;

  const status: PublishStatus = {
    pkid: 1,
    description: '草稿',
    isDraft: true,
    isPublished: false,
    isDiscontinued: false,
    courseCount: 0,
    promotion2Count: 0,
  };

  const request: PublishStatusRequest = {
    pkid: 10,
    description: '審核中',
    isDraft: true,
    isPublished: false,
    isDiscontinued: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PublishStatusService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /publish-statuses', () => {
    service.getAll().subscribe((rows) => expect(rows).toEqual([status]));
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([status]);
  });

  it('query() POSTs the filter to /publish-statuses/query', () => {
    const filter = { keyword: '草', isDraft: true, isPublished: null, isDiscontinued: false };
    service.query(filter).subscribe((rows) => expect(rows.length).toBe(1));
    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(filter);
    req.flush([status]);
  });

  it('getById() GETs /publish-statuses/{pkid}', () => {
    service.getById(1).subscribe((s) => expect(s.description).toBe('草稿'));
    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(status);
  });

  it('create() POSTs the request body (including the supplied pkid)', () => {
    service.create(request).subscribe((s) => expect(s.pkid).toBe(10));
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...status, ...request });
  });

  it('update() PUTs to /publish-statuses with pkid in the body (no route param)', () => {
    service.update({ ...request, pkid: 2 }).subscribe();
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(2);
    req.flush(status);
  });

  it('delete() DELETEs /publish-statuses/{pkid}', () => {
    service.delete(3).subscribe();
    const req = http.expectOne(`${baseUrl}/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
