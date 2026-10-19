import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { CourseGroup } from '../course-group.model';
import { CourseGroupService } from '../course-group.service';
import { CourseGroupDetail } from './course-group-detail';

describe('CourseGroupDetail', () => {
  let fixture: ComponentFixture<CourseGroupDetail>;
  let service: jasmine.SpyObj<CourseGroupService>;

  const group: CourseGroup = { pkid: 46, description: 'Microsoft 365', courseCount: 34, partnerCourseGroupCount: 1 };

  function create(id = '46'): HTMLElement {
    fixture = TestBed.createComponent(CourseGroupDetail);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj<CourseGroupService>('CourseGroupService', ['getById']);
    service.getById.and.returnValue(of(group));

    await TestBed.configureTestingModule({
      imports: [CourseGroupDetail],
      providers: [provideRouter([]), MessageService, { provide: CourseGroupService, useValue: service }],
    }).compileComponents();
  });

  it('loads the group by route id and renders its fields and usage counts', () => {
    const el = create('46');
    expect(service.getById).toHaveBeenCalledOnceWith(46);
    const text = (f: string) => el.querySelector(`[data-field="${f}"]`)?.textContent?.trim();
    expect(text('pkid')).toBe('46');
    expect(text('description')).toBe('Microsoft 365');
    expect(text('courseCount')).toBe('34 筆');
    expect(el.querySelector('[data-field="courseCount"] a')!.getAttribute('href')).toBe('/courses?courseGroupPkid=46');
    expect(text('partnerCourseGroupCount')).toBe('1 筆');
  });

  it('shows a not-found message on 404', () => {
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const el = create('99');
    expect(el.textContent).toContain('找不到此課程群組資料');
    expect(el.querySelector('[data-field="description"]')).toBeNull();
  });

  it('edit() navigates to the edit page; back() to the list', () => {
    create('46');
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture.componentInstance.edit();
    expect(router.navigate).toHaveBeenCalledWith(['/course-groups', '46', 'edit']);

    fixture.componentInstance.back();
    expect(router.navigate).toHaveBeenCalledWith(['/course-groups']);
  });
});
