import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RowAuditService } from '../../../core/components/row-audit-badge/row-audit.service';
import { MessageService } from 'primeng/api';
import { Partner } from '../partner.model';
import { PartnerService } from '../partner.service';
import { PartnerForm } from './partner-form';

describe('PartnerForm', () => {
  let fixture: ComponentFixture<PartnerForm>;
  let component: PartnerForm;
  let service: jasmine.SpyObj<PartnerService>;
  let router: Router;
  let messages: MessageService;

  const partner: Partner = {
    pkid: 2,
    name: 'Oracle',
    appKey: 'Oracle',
    nameOnPartnerMenu: 'Oracle 甲骨文',
    nameOnCourseDetailPage: 'Oracle',
    displayOrder: 2201,
    imageFilename: null,
    courseCount: 57,
    certificationCount: 3,
    partnerCourseGroupCount: 6,
    promotion2Count: 0,
    seminarCount: 0,
  };

  const valid = {
    name: ' AWS ',
    appKey: ' AWS ',
    nameOnPartnerMenu: 'Amazon Web Services',
    nameOnCourseDetailPage: 'AWS',
    displayOrder: 1101,
    imageFilename: '  ',
  };

  function create(id?: string): void {
    fixture = TestBed.createComponent(PartnerForm);
    component = fixture.componentInstance;
    if (id) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj<PartnerService>('PartnerService', ['getById', 'create', 'update']);
    service.getById.and.returnValue(of(partner));
    service.create.and.callFake((req) => of({ ...partner, ...req, pkid: 135, courseCount: 0 }));
    service.update.and.callFake((req) => of({ ...partner, ...req }));

    await TestBed.configureTestingModule({
      imports: [PartnerForm],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: PartnerService, useValue: service },
        { provide: RowAuditService, useValue: jasmine.createSpyObj<RowAuditService>('RowAuditService', { getHistory: of([]) }) },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    messages = TestBed.inject(MessageService);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  describe('add mode', () => {
    beforeEach(() => create());

    it('starts empty with displayOrder 0', () => {
      expect(component.isEdit()).toBeFalse();
      expect(component.form.getRawValue()).toEqual({
        name: '',
        appKey: '',
        nameOnPartnerMenu: '',
        nameOnCourseDetailPage: '',
        displayOrder: 0,
        imageFilename: '',
      });
      expect(service.getById).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('新增原廠');
    });

    it('does not submit when required fields are missing, and shows errors', () => {
      component.save();
      fixture.detectChanges();

      expect(service.create).not.toHaveBeenCalled();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('請輸入名稱');
      expect(text).toContain('請輸入應用代碼');
      expect(text).toContain('請輸入原廠選單名稱');
      expect(text).toContain('請輸入課程頁名稱');
    });

    it('enforces max lengths and ASCII-only varchar fields', () => {
      component.form.patchValue({ ...valid, appKey: '中文', imageFilename: 'x'.repeat(51), name: 'x'.repeat(51) });
      component.save();

      expect(service.create).not.toHaveBeenCalled();
      expect(component.form.controls.appKey.hasError('pattern')).toBeTrue();
      expect(component.form.controls.imageFilename.hasError('maxlength')).toBeTrue();
      expect(component.form.controls.name.hasError('maxlength')).toBeTrue();
    });

    it('creates with trimmed values (blank image → null, no pkid), then navigates to detail', () => {
      component.form.patchValue(valid);
      component.save();

      expect(service.create).toHaveBeenCalledOnceWith({
        name: 'AWS',
        appKey: 'AWS',
        nameOnPartnerMenu: 'Amazon Web Services',
        nameOnCourseDetailPage: 'AWS',
        displayOrder: 1101,
        imageFilename: null,
      });
      expect(router.navigate).toHaveBeenCalledWith(['/partners', 135]);
    });

    it('shows the server message when AppKey already exists (409)', () => {
      service.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { message: "應用代碼 'AWS' 已存在" } })),
      );
      const add = spyOn(messages, 'add');
      component.form.patchValue(valid);
      component.save();

      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: "應用代碼 'AWS' 已存在" }));
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });

    it('leaves the 5xx toast to the interceptor (no second toast) when saving fails', () => {
      service.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500, error: { message: '系統發生未預期的錯誤，請稍後再試' } })),
      );
      const add = spyOn(messages, 'add');
      component.form.patchValue(valid);
      component.save();

      expect(add).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });

    it('cancel() returns to the list', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/partners']);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => create('2'));

    it('loads the partner and patches the form', () => {
      expect(service.getById).toHaveBeenCalledOnceWith(2);
      expect(component.form.getRawValue()).toEqual({
        name: 'Oracle',
        appKey: 'Oracle',
        nameOnPartnerMenu: 'Oracle 甲骨文',
        nameOnCourseDetailPage: 'Oracle',
        displayOrder: 2201,
        imageFilename: '',
      });
      expect(fixture.nativeElement.textContent).toContain('編輯原廠');
    });

    it('updates with pkid in the body and navigates to the detail page', () => {
      component.form.patchValue({ name: 'Oracle Corp', imageFilename: 'Oracle.svg' });
      component.save();

      expect(service.update).toHaveBeenCalledOnceWith({
        pkid: 2,
        name: 'Oracle Corp',
        appKey: 'Oracle',
        nameOnPartnerMenu: 'Oracle 甲骨文',
        nameOnCourseDetailPage: 'Oracle',
        displayOrder: 2201,
        imageFilename: 'Oracle.svg',
      });
      expect(service.create).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/partners', 2]);
    });

    it('cancel() returns to the detail page', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/partners', '2']);
    });
  });

  it('shows the 異動紀錄 badge only when editing an existing record', () => {
    create();
    expect(fixture.nativeElement.querySelector('app-row-audit-badge')).toBeNull();
    fixture.destroy();

    create('2');
    expect(fixture.nativeElement.querySelector('.page-header .start app-row-audit-badge')).not.toBeNull();
    expect(TestBed.inject(RowAuditService).getHistory).toHaveBeenCalledOnceWith('Partner', '2');
  });
});
