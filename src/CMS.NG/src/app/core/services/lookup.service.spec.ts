import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { LookupService } from './lookup.service';

describe('LookupService', () => {
  let service: LookupService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LookupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAppUsers() GETs /lookups/app-users', () => {
    const users = [{ pkid: 1, userId: 'alice', userName: 'Alice' }];
    service.getAppUsers().subscribe((rows) => expect(rows).toEqual(users));
    const req = http.expectOne(`${environment.apiUrl}/lookups/app-users`);
    expect(req.request.method).toBe('GET');
    req.flush(users);
  });

  it('getAppRoles() GETs /lookups/app-roles', () => {
    const roles = [{ pkid: 1, roleId: 'Admin', roleName: 'Administrator' }];
    service.getAppRoles().subscribe((rows) => expect(rows).toEqual(roles));
    const req = http.expectOne(`${environment.apiUrl}/lookups/app-roles`);
    expect(req.request.method).toBe('GET');
    req.flush(roles);
  });

  it('getPublishStatuses() GETs /lookups/publish-statuses', () => {
    const statuses = [{ pkid: 1, description: '草稿' }];
    service.getPublishStatuses().subscribe((rows) => expect(rows).toEqual(statuses));
    const req = http.expectOne(`${environment.apiUrl}/lookups/publish-statuses`);
    expect(req.request.method).toBe('GET');
    req.flush(statuses);
  });

  it('getPartners() GETs /lookups/partners', () => {
    const partners = [{ pkid: 4, name: 'Cisco' }];
    service.getPartners().subscribe((rows) => expect(rows).toEqual(partners));
    const req = http.expectOne(`${environment.apiUrl}/lookups/partners`);
    expect(req.request.method).toBe('GET');
    req.flush(partners);
  });

  it('getCourseGroups() GETs /lookups/course-groups', () => {
    const groups = [{ pkid: 46, description: 'Microsoft 365' }];
    service.getCourseGroups().subscribe((rows) => expect(rows).toEqual(groups));
    const req = http.expectOne(`${environment.apiUrl}/lookups/course-groups`);
    expect(req.request.method).toBe('GET');
    req.flush(groups);
  });

  it('getCertifications() GETs /lookups/certifications', () => {
    const certs = [{ pkid: 7, title: 'Cisco Certified CCNP', partnerName: 'Cisco' }];
    service.getCertifications().subscribe((rows) => expect(rows).toEqual(certs));
    const req = http.expectOne(`${environment.apiUrl}/lookups/certifications`);
    expect(req.request.method).toBe('GET');
    req.flush(certs);
  });

  it('getJobCategories() GETs /lookups/job-categories', () => {
    const jobs = [{ pkid: 1, description: '網路系統工程' }];
    service.getJobCategories().subscribe((rows) => expect(rows).toEqual(jobs));
    const req = http.expectOne(`${environment.apiUrl}/lookups/job-categories`);
    expect(req.request.method).toBe('GET');
    req.flush(jobs);
  });

  it('getCourses() GETs /lookups/courses', () => {
    const courses = [{ pkid: 42, courseId: 'CCNP', title: 'CCNP' }];
    service.getCourses().subscribe((rows) => expect(rows).toEqual(courses));
    const req = http.expectOne(`${environment.apiUrl}/lookups/courses`);
    expect(req.request.method).toBe('GET');
    req.flush(courses);
  });
});
