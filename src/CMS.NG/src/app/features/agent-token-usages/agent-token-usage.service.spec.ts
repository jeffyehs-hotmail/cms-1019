import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { AgentTokenUsageService } from './agent-token-usage.service';

describe('AgentTokenUsageService', () => {
  let service: AgentTokenUsageService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/agent-token-usages`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AgentTokenUsageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('query() POSTs the filters to /query', () => {
    const q = { from: '2026-10-01', to: '2026-10-31', userIds: ['alice'], projects: [], models: [] };
    service.query(q).subscribe();
    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(q);
    req.flush([]);
  });

  it('getFilterOptions() GETs /filter-options', () => {
    let projects: string[] = [];
    service.getFilterOptions().subscribe((o) => (projects = o.projects));
    const req = http.expectOne(`${baseUrl}/filter-options`);
    expect(req.request.method).toBe('GET');
    req.flush({ projects: ['cms-1019'], models: [] });
    expect(projects).toEqual(['cms-1019']);
  });
});
