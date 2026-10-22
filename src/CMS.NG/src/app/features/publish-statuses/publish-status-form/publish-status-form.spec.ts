import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RowAuditService } from '../../../core/components/row-audit-badge/row-audit.service';
import { MessageService } from 'primeng/api';
import { PublishStatus } from '../publish-status.model';
import { PublishStatusService } from '../publish-status.service';
import { PublishStatusForm } from './publish-status-form';

describe('PublishStatusForm', () => {
  let fixture: ComponentFixture<PublishStatusForm>;
  let component: PublishStatusForm;
  let service: jasmine.SpyObj<PublishStatusService>;
  let router: Router;
  let messages: MessageService;

  const status: PublishStatus = {
    pkid: 1,
    description: '草稿',
    isDraft: true,
    isPublished: false,
    isDiscontinued: false,
    courseCount: 7,
    promotion2Count: 0,
  };

  function create(id?: string): void {
    fixture = TestBed.createComponent(PublishStatusForm);
    component = fixture.componentInstance;
    if (id) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj<PublishStatusService>('PublishStatusService', ['getById', 'create', 'update']);
    service.getById.and.returnValue(of(status));
    service.create.and.callFake((req) => of({ ...status, ...req, courseCount: 0 }));
    service.update.and.callFake((req) => of({ ...status, ...req }));

    await TestBed.configureTestingModule({
      imports: [PublishStatusForm],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: PublishStatusService, useValue: service },
        { provide: RowAuditService, useValue: jasmine.createSpyObj<RowAuditService>('RowAuditService', { getHistory: of([]) }) },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    messages = TestBed.inject(MessageService);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  describe('add mode', () => {
    beforeEach(() => create());

    it('starts empty with flags false and pkid enabled', () => {
      expect(component.isEdit()).toBeFalse();
      expect(component.form.getRawValue()).toEqual({
        pkid: null,
        description: '',
        isDraft: false,
        isPublished: false,
        isDiscontinued: false,
      });
      expect(component.form.controls.pkid.enabled).toBeTrue();
      expect(service.getById).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('新增發布狀態');
    });

    it('does not submit when required fields are missing, and shows errors', () => {
      component.save();
      fixture.detectChanges();

      expect(service.create).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('請輸入 1–255 的主代碼');
      expect(fixture.nativeElement.textContent).toContain('請輸入狀態名稱');
    });

    it('rejects pkid outside 1–255 and description over 50 characters', () => {
      component.form.patchValue({ pkid: 256, description: 'x'.repeat(51) });
      component.save();
      expect(service.create).not.toHaveBeenCalled();
      expect(component.form.controls.pkid.hasError('max')).toBeTrue();
      expect(component.form.controls.description.hasError('maxlength')).toBeTrue();
    });

    it('creates with the supplied pkid and a trimmed description, then navigates to detail', () => {
      component.form.patchValue({ pkid: 10, description: ' 審核中 ', isDraft: true });
      component.save();

      expect(service.create).toHaveBeenCalledOnceWith({
        pkid: 10,
        description: '審核中',
        isDraft: true,
        isPublished: false,
        isDiscontinued: false,
      });
      expect(router.navigate).toHaveBeenCalledWith(['/publish-statuses', 10]);
    });

    it('shows the server message when pkid already exists (409)', () => {
      service.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { message: '主代碼 1 已存在' } })),
      );
      const add = spyOn(messages, 'add');
      component.form.patchValue({ pkid: 1, description: 'x' });
      component.save();

      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '主代碼 1 已存在' }));
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });

    it('leaves the 5xx toast to the interceptor (no second toast) when saving fails', () => {
      service.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500, error: { message: '系統發生未預期的錯誤，請稍後再試' } })),
      );
      const add = spyOn(messages, 'add');
      component.form.patchValue({ pkid: 1, description: 'x' });
      component.save();

      expect(add).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });

    it('cancel() returns to the list', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/publish-statuses']);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => create('1'));

    it('loads the status and patches the form', () => {
      expect(service.getById).toHaveBeenCalledOnceWith(1);
      expect(component.form.getRawValue()).toEqual({
        pkid: 1,
        description: '草稿',
        isDraft: true,
        isPublished: false,
        isDiscontinued: false,
      });
      expect(fixture.nativeElement.textContent).toContain('編輯發布狀態');
    });

    it('disables pkid (immutable primary key)', () => {
      expect(component.form.controls.pkid.disabled).toBeTrue();
    });

    it('updates with pkid in the body and navigates to the detail page', () => {
      component.form.patchValue({ description: 'Draft', isPublished: true });
      component.save();

      expect(service.update).toHaveBeenCalledOnceWith({
        pkid: 1,
        description: 'Draft',
        isDraft: true,
        isPublished: true,
        isDiscontinued: false,
      });
      expect(service.create).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/publish-statuses', 1]);
    });

    it('cancel() returns to the detail page', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/publish-statuses', '1']);
    });
  });

  it('toasts the API message when loading is refused (403 for a non-admin)', () => {
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403, error: { message: '權限不足，無法執行此操作' } })));
    const add = spyOn(messages, 'add');
    create('1');
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '權限不足，無法執行此操作' }));
  });

  it('shows the 異動紀錄 badge only when editing an existing record', () => {
    create();
    expect(fixture.nativeElement.querySelector('app-row-audit-badge')).toBeNull();
    fixture.destroy();

    create('1');
    expect(fixture.nativeElement.querySelector('.page-header .start app-row-audit-badge')).not.toBeNull();
    expect(TestBed.inject(RowAuditService).getHistory).toHaveBeenCalledOnceWith('PublishStatus', '1');
  });
});
