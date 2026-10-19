import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { Partner, PartnerRequest } from './partner.model';
import { PartnerService } from './partner.service';

describe('PartnerService', () => {
  const baseUrl = `${environment.apiUrl}/partners`;
  let service: PartnerService;
  let http: HttpTestingController;

  const partner: Partner = {
    pkid: 1,
    name: 'Microsoft',
    appKey: 'ms',
    nameOnPartnerMenu: 'Microsoft 微軟',
    nameOnCourseDetailPage: '微軟',
    displayOrder: 2001,
    imageFilename: 'ms.png',
    courseCount: 243,
    certificationCount: 1,
    partnerCourseGroupCount: 17,
    promotion2Count: 0,
    seminarCount: 0,
  };

  const request: PartnerRequest = {
    name: 'AWS',
    appKey: 'AWS',
    nameOnPartnerMenu: 'Amazon Web Services',
    nameOnCourseDetailPage: 'AWS',
    displayOrder: 1101,
    imageFilename: 'AWS.svg',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PartnerService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /partners', () => {
    service.getAll().subscribe((rows) => expect(rows).toEqual([partner]));
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([partner]);
  });

  it('query() POSTs the filter to /partners/query', () => {
    const filter = { keyword: 'ms' };
    service.query(filter).subscribe((rows) => expect(rows.length).toBe(1));
    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(filter);
    req.flush([partner]);
  });

  it('getById() GETs /partners/{pkid}', () => {
    service.getById(1).subscribe((p) => expect(p.name).toBe('Microsoft'));
    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(partner);
  });

  it('create() POSTs the request body', () => {
    service.create(request).subscribe((p) => expect(p.pkid).toBe(69));
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...partner, ...request, pkid: 69 });
  });

  it('update() PUTs to /partners with pkid in the body (no route param)', () => {
    service.update({ ...request, pkid: 2 }).subscribe();
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(2);
    req.flush(partner);
  });

  it('delete() DELETEs /partners/{pkid}', () => {
    service.delete(3).subscribe();
    const req = http.expectOne(`${baseUrl}/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
