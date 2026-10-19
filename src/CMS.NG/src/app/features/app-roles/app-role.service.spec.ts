import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { AppRole, AppRoleRequest } from './app-role.model';
import { AppRoleService } from './app-role.service';

describe('AppRoleService', () => {
  const baseUrl = `${environment.apiUrl}/app-roles`;
  let service: AppRoleService;
  let http: HttpTestingController;

  const role: AppRole = {
    pkid: 1,
    roleId: 'Admin',
    roleName: 'Administrator',
    permissionLevel: 1,
    description: '系統管理員',
    userCount: 1,
    users: [],
  };

  const request: AppRoleRequest = {
    pkid: 0,
    roleId: 'Auditor',
    roleName: 'Auditor',
    permissionLevel: 80,
    description: null,
    userIds: ['alice'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AppRoleService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /app-roles', () => {
    service.getAll().subscribe((rows) => expect(rows).toEqual([role]));
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([role]);
  });

  it('query() POSTs the filter to /app-roles/query', () => {
    const filter = { keyword: 'adm', permissionLevelFrom: 1, permissionLevelTo: 10 };
    service.query(filter).subscribe((rows) => expect(rows.length).toBe(1));
    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(filter);
    req.flush([role]);
  });

  it('getById() GETs /app-roles/{pkid}', () => {
    service.getById(1).subscribe((r) => expect(r.roleId).toBe('Admin'));
    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(role);
  });

  it('create() POSTs the request body to /app-roles', () => {
    service.create(request).subscribe((r) => expect(r.pkid).toBe(5));
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...role, pkid: 5, roleId: 'Auditor' });
  });

  it('update() PUTs to /app-roles with pkid in the body (no route param)', () => {
    const update = { ...request, pkid: 2 };
    service.update(update).subscribe();
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(2);
    req.flush(role);
  });

  it('delete() DELETEs /app-roles/{pkid}', () => {
    service.delete(3).subscribe();
    const req = http.expectOne(`${baseUrl}/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
