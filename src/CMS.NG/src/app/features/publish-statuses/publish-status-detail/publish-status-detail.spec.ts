import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RowAuditService } from '../../../core/components/row-audit-badge/row-audit.service';
import { MessageService } from 'primeng/api';
import { PublishStatus } from '../publish-status.model';
import { PublishStatusService } from '../publish-status.service';
import { PublishStatusDetail } from './publish-status-detail';

describe('PublishStatusDetail', () => {
  let fixture: ComponentFixture<PublishStatusDetail>;
  let service: jasmine.SpyObj<PublishStatusService>;

  const status: PublishStatus = {
    pkid: 2,
    description: '上架中',
    isDraft: false,
    isPublished: true,
    isDiscontinued: false,
    courseCount: 436,
    promotion2Count: 294,
  };

  function create(id = '2'): HTMLElement {
    fixture = TestBed.createComponent(PublishStatusDetail);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj<PublishStatusService>('PublishStatusService', ['getById']);
    service.getById.and.returnValue(of(status));

    await TestBed.configureTestingModule({
      imports: [PublishStatusDetail],
      providers: [provideRouter([]), MessageService, { provide: PublishStatusService, useValue: service }, { provide: RowAuditService, useValue: jasmine.createSpyObj<RowAuditService>('RowAuditService', { getHistory: of([]) }) }],
    }).compileComponents();
  });

  it('loads the status by route id and renders its fields', () => {
    const el = create('2');
    expect(service.getById).toHaveBeenCalledOnceWith(2);
    const text = (f: string) => el.querySelector(`[data-field="${f}"]`)?.textContent?.trim();
    expect(text('pkid')).toBe('2');
    expect(text('description')).toBe('上架中');
    expect(text('isDraft')).toBe('否');
    expect(text('isPublished')).toBe('是');
    expect(text('isDiscontinued')).toBe('否');
    expect(text('courseCount')).toBe('436 筆');
    expect(el.querySelector('[data-field="courseCount"] a')!.getAttribute('href')).toBe('/courses?publishStatusPkid=2');
    expect(text('promotion2Count')).toBe('294 筆');
  });

  it('shows a not-found message on 404', () => {
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const el = create('99');
    expect(el.textContent).toContain('找不到此發布狀態資料');
    expect(el.querySelector('[data-field="description"]')).toBeNull();
  });

  it('leaves the 5xx toast to the interceptor (no second toast) when loading fails', () => {
    service.getById.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: '系統發生未預期的錯誤，請稍後再試' } })),
    );
    const add = spyOn(TestBed.inject(MessageService), 'add');
    create('2');
    expect(add).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(fixture.componentInstance.notFound()).toBeTrue();
  });

  it('toasts the API message when loading is refused (403 for a non-admin)', () => {
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403, error: { message: '權限不足，無法執行此操作' } })));
    const add = spyOn(TestBed.inject(MessageService), 'add');
    create('2');
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '權限不足，無法執行此操作' }));
  });

  it('edit() navigates to the edit page; back() to the list', () => {
    create('2');
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture.componentInstance.edit();
    expect(router.navigate).toHaveBeenCalledWith(['/publish-statuses', '2', 'edit']);

    fixture.componentInstance.back();
    expect(router.navigate).toHaveBeenCalledWith(['/publish-statuses']);
  });

  it('shows the 異動紀錄 badge for this record in the page header', () => {
    const el = create('2');
    expect(el.querySelector('.page-header .start app-row-audit-badge')).not.toBeNull();
    expect(TestBed.inject(RowAuditService).getHistory).toHaveBeenCalledOnceWith('PublishStatus', '2');
  });
});
