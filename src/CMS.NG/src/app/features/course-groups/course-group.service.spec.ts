import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { CourseGroup, CourseGroupRequest } from './course-group.model';
import { CourseGroupService } from './course-group.service';

describe('CourseGroupService', () => {
  const baseUrl = `${environment.apiUrl}/course-groups`;
  let service: CourseGroupService;
  let http: HttpTestingController;

  const group: CourseGroup = { pkid: 1, description: 'Windows Server', courseCount: 12, partnerCourseGroupCount: 1 };
  const request: CourseGroupRequest = { description: 'Linux' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CourseGroupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /course-groups', () => {
    service.getAll().subscribe((rows) => expect(rows).toEqual([group]));
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([group]);
  });

  it('query() POSTs the filter to /course-groups/query', () => {
    const filter = { keyword: 'win' };
    service.query(filter).subscribe((rows) => expect(rows.length).toBe(1));
    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(filter);
    req.flush([group]);
  });

  it('getById() GETs /course-groups/{pkid}', () => {
    service.getById(1).subscribe((g) => expect(g.description).toBe('Windows Server'));
    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(group);
  });

  it('create() POSTs the request body', () => {
    service.create(request).subscribe((g) => expect(g.pkid).toBe(261));
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...group, ...request, pkid: 261 });
  });

  it('update() PUTs to /course-groups with pkid in the body (no route param)', () => {
    service.update({ ...request, pkid: 2 }).subscribe();
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(2);
    req.flush(group);
  });

  it('delete() DELETEs /course-groups/{pkid}', () => {
    service.delete(3).subscribe();
    const req = http.expectOne(`${baseUrl}/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
