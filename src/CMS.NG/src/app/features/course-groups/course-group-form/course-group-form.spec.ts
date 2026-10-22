import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RowAuditService } from '../../../core/components/row-audit-badge/row-audit.service';
import { MessageService } from 'primeng/api';
import { CourseGroup } from '../course-group.model';
import { CourseGroupService } from '../course-group.service';
import { CourseGroupForm } from './course-group-form';

describe('CourseGroupForm', () => {
  let fixture: ComponentFixture<CourseGroupForm>;
  let component: CourseGroupForm;
  let service: jasmine.SpyObj<CourseGroupService>;
  let router: Router;
  let messages: MessageService;

  const group: CourseGroup = { pkid: 2, description: 'Azure 雲端', courseCount: 5, partnerCourseGroupCount: 1 };

  function create(id?: string): void {
    fixture = TestBed.createComponent(CourseGroupForm);
    component = fixture.componentInstance;
    if (id) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj<CourseGroupService>('CourseGroupService', ['getById', 'create', 'update']);
    service.getById.and.returnValue(of(group));
    service.create.and.callFake((req) => of({ ...group, ...req, pkid: 261, courseCount: 0, partnerCourseGroupCount: 0 }));
    service.update.and.callFake((req) => of({ ...group, ...req }));

    await TestBed.configureTestingModule({
      imports: [CourseGroupForm],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: CourseGroupService, useValue: service },
        { provide: RowAuditService, useValue: jasmine.createSpyObj<RowAuditService>('RowAuditService', { getHistory: of([]) }) },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    messages = TestBed.inject(MessageService);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  describe('add mode', () => {
    beforeEach(() => create());

    it('starts empty', () => {
      expect(component.isEdit()).toBeFalse();
      expect(component.form.getRawValue()).toEqual({ description: '' });
      expect(service.getById).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('新增課程群組');
    });

    it('does not submit when the description is missing, and shows an error', () => {
      component.save();
      fixture.detectChanges();

      expect(service.create).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('請輸入群組名稱');
    });

    it('rejects whitespace-only and over-long descriptions', () => {
      component.form.patchValue({ description: '   ' });
      component.save();
      expect(service.create).not.toHaveBeenCalled();

      component.form.patchValue({ description: 'x'.repeat(101) });
      component.save();
      expect(service.create).not.toHaveBeenCalled();
      expect(component.form.controls.description.hasError('maxlength')).toBeTrue();
    });

    it('creates with a trimmed description (no pkid), then navigates to detail', () => {
      component.form.patchValue({ description: '  Linux  ' });
      component.save();

      expect(service.create).toHaveBeenCalledOnceWith({ description: 'Linux' });
      expect(router.navigate).toHaveBeenCalledWith(['/course-groups', 261]);
    });

    it('shows an error toast and stays on the page when saving fails', () => {
      service.create.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
      const add = spyOn(messages, 'add');
      component.form.patchValue({ description: 'Linux' });
      component.save();

      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '儲存失敗' }));
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });

    it('leaves the 5xx toast to the interceptor (no second toast) when saving fails', () => {
      service.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500, error: { message: '系統發生未預期的錯誤，請稍後再試' } })),
      );
      const add = spyOn(messages, 'add');
      component.form.patchValue({ description: 'Linux' });
      component.save();

      expect(add).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });

    it('cancel() returns to the list', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/course-groups']);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => create('2'));

    it('loads the group and patches the form', () => {
      expect(service.getById).toHaveBeenCalledOnceWith(2);
      expect(component.form.getRawValue()).toEqual({ description: 'Azure 雲端' });
      expect(fixture.nativeElement.textContent).toContain('編輯課程群組');
    });

    it('updates with pkid in the body and navigates to the detail page', () => {
      component.form.patchValue({ description: 'Azure' });
      component.save();

      expect(service.update).toHaveBeenCalledOnceWith({ pkid: 2, description: 'Azure' });
      expect(service.create).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/course-groups', 2]);
    });

    it('cancel() returns to the detail page', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/course-groups', '2']);
    });
  });

  it('shows the 異動紀錄 badge only when editing an existing record', () => {
    create();
    expect(fixture.nativeElement.querySelector('app-row-audit-badge')).toBeNull();
    fixture.destroy();

    create('2');
    expect(fixture.nativeElement.querySelector('.page-header .start app-row-audit-badge')).not.toBeNull();
    expect(TestBed.inject(RowAuditService).getHistory).toHaveBeenCalledOnceWith('CourseGroup', '2');
  });
});
