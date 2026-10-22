import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { AppUser, AppUserRequest } from './app-user.model';
import { AppUserService } from './app-user.service';

describe('AppUserService', () => {
  const baseUrl = `${environment.apiUrl}/app-users`;
  let service: AppUserService;
  let http: HttpTestingController;

  const user: AppUser = {
    pkid: 1,
    userId: 'alice',
    userName: 'Alice',
    isActive: true,
    passwordUpdatedTime: null,
    roleCount: 1,
    hasAgentToken: false,
    agentTokenUsageCount: 0,
    roles: [],
  };

  const request: AppUserRequest = { pkid: 0, userId: 'dave', userName: 'Dave', isActive: true, roleIds: ['Admin'] };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AppUserService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs the collection', () => {
    service.getAll().subscribe((rows) => expect(rows).toEqual([user]));
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([user]);
  });

  it('query() POSTs the filter to /query', () => {
    const q = { keyword: 'ali', isActive: true, roleId: 'Admin' };
    service.query(q).subscribe((rows) => expect(rows).toEqual([user]));
    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(q);
    req.flush([user]);
  });

  it('getById() GETs /{pkid}', () => {
    service.getById(1).subscribe((u) => expect(u).toEqual(user));
    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(user);
  });

  it('create() POSTs the request without any password field', () => {
    service.create(request).subscribe();
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(Object.keys(req.request.body).some((k) => /password/i.test(k))).toBeFalse();
    req.flush(user);
  });

  it('update() PUTs the request', () => {
    service.update({ ...request, pkid: 1 }).subscribe();
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(1);
    req.flush(user);
  });

  it('resetPassword() POSTs /{pkid}/reset-password', () => {
    service.resetPassword(1).subscribe();
    const req = http.expectOne(`${baseUrl}/1/reset-password`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('regenerateAgentToken() POSTs /{pkid}/regenerate-agent-token and returns the token', () => {
    let token = '';
    service.regenerateAgentToken(1).subscribe((r) => (token = r.token));
    const req = http.expectOne(`${baseUrl}/1/regenerate-agent-token`);
    expect(req.request.method).toBe('POST');
    req.flush({ token: 'cms_at_x' });
    expect(token).toBe('cms_at_x');
  });

  it('revokeAgentToken() POSTs /{pkid}/revoke-agent-token', () => {
    service.revokeAgentToken(1).subscribe();
    const req = http.expectOne(`${baseUrl}/1/revoke-agent-token`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('delete() DELETEs /{pkid}', () => {
    service.delete(1).subscribe();
    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
