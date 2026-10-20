import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { RowAuditEntry, RowAuditService } from './row-audit.service';

describe('RowAuditService', () => {
  let service: RowAuditService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RowAuditService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GETs api/rowaudit with tableName and pkid', () => {
    const rows: RowAuditEntry[] = [{ dateTime: '2026-06-04T14:30:00', userName: 'alice', actionType: 'Update', actionDesc: 'Title' }];
    let result: RowAuditEntry[] | undefined;

    service.getHistory('Course', 123).subscribe((r) => (result = r));

    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/rowaudit`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('tableName')).toBe('Course');
    expect(req.request.params.get('pkid')).toBe('123');
    req.flush(rows);
    expect(result).toEqual(rows);
  });
});
