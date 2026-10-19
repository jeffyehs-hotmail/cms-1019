import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { Course, CourseRequest } from './course.model';
import { CourseService } from './course.service';

describe('CourseService', () => {
  const baseUrl = `${environment.apiUrl}/courses`;
  let service: CourseService;
  let http: HttpTestingController;

  const course = { pkid: 42, courseId: 'CCNP', title: 'CCNP 課程' } as Course;

  const request: CourseRequest = {
    title: 'CCNP 課程',
    officialTitle: null,
    courseId: 'CCNP',
    prodCourseId: 'CCNP',
    friendlyUrl: 'ccnp',
    displayOrder: 1,
    partnerPkid: 3,
    courseGroupPkid: null,
    publishStatusPkid: 2,
    scheduleOn: '2026-01-01',
    scheduleOff: '2027-12-31',
    hour: 40,
    listPrice: 30000,
    learningCredit: 5,
    canRepeat: true,
    material: null,
    objective: null,
    target: null,
    prerequisites: null,
    outline: null,
    towardCertOrExam: null,
    note: null,
    otherInfo: null,
    certificationPkids: [7],
    jobCategoryPkids: [1, 15],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CourseService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /courses', () => {
    service.getAll().subscribe((rows) => expect(rows).toEqual([course]));
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([course]);
  });

  it('query() POSTs the filter to /courses/query', () => {
    const query = { keyword: 'cc', partnerPkid: 3, scheduleOnFrom: '2026-01-01', canRepeat: true };
    service.query(query).subscribe();
    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(query);
    req.flush([]);
  });

  it('getById() GETs /courses/:pkid', () => {
    service.getById(42).subscribe((c) => expect(c).toEqual(course));
    const req = http.expectOne(`${baseUrl}/42`);
    expect(req.request.method).toBe('GET');
    req.flush(course);
  });

  it('create() POSTs to /courses', () => {
    service.create(request).subscribe();
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(course);
  });

  it('update() PUTs to /courses with pkid in the body', () => {
    service.update({ ...request, pkid: 42 }).subscribe();
    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(42);
    req.flush(course);
  });

  it('delete() DELETEs /courses/:pkid', () => {
    service.delete(42).subscribe();
    const req = http.expectOne(`${baseUrl}/42`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
