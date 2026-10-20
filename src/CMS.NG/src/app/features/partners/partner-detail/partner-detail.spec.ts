import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RowAuditService } from '../../../core/components/row-audit-badge/row-audit.service';
import { MessageService } from 'primeng/api';
import { Partner } from '../partner.model';
import { PartnerService } from '../partner.service';
import { PartnerDetail } from './partner-detail';

describe('PartnerDetail', () => {
  let fixture: ComponentFixture<PartnerDetail>;
  let service: jasmine.SpyObj<PartnerService>;

  const partner: Partner = {
    pkid: 4,
    name: 'Cisco',
    appKey: 'cisco',
    nameOnPartnerMenu: 'Cisco 思科',
    nameOnCourseDetailPage: 'Cisco',
    displayOrder: 1201,
    imageFilename: null,
    courseCount: 41,
    certificationCount: 3,
    partnerCourseGroupCount: 7,
    promotion2Count: 2,
    seminarCount: 5,
  };

  function create(id = '4'): HTMLElement {
    fixture = TestBed.createComponent(PartnerDetail);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj<PartnerService>('PartnerService', ['getById']);
    service.getById.and.returnValue(of(partner));

    await TestBed.configureTestingModule({
      imports: [PartnerDetail],
      providers: [provideRouter([]), MessageService, { provide: PartnerService, useValue: service }, { provide: RowAuditService, useValue: jasmine.createSpyObj<RowAuditService>('RowAuditService', { getHistory: of([]) }) }],
    }).compileComponents();
  });

  it('loads the partner by route id and renders its fields and usage counts', () => {
    const el = create('4');
    expect(service.getById).toHaveBeenCalledOnceWith(4);
    const text = (f: string) => el.querySelector(`[data-field="${f}"]`)?.textContent?.trim();
    expect(text('pkid')).toBe('4');
    expect(text('name')).toBe('Cisco');
    expect(text('appKey')).toBe('cisco');
    expect(text('nameOnPartnerMenu')).toBe('Cisco 思科');
    expect(text('nameOnCourseDetailPage')).toBe('Cisco');
    expect(text('displayOrder')).toBe('1201');
    expect(text('imageFilename')).toBe('—');
    expect(text('courseCount')).toBe('41 筆');
    expect(el.querySelector('[data-field="courseCount"] a')!.getAttribute('href')).toBe('/courses?partnerPkid=4');
    expect(text('certificationCount')).toBe('3 筆');
    expect(text('partnerCourseGroupCount')).toBe('7 筆');
    expect(text('promotion2Count')).toBe('2 筆');
    expect(text('seminarCount')).toBe('5 筆');
  });

  it('shows a not-found message on 404', () => {
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const el = create('99');
    expect(el.textContent).toContain('找不到此原廠資料');
    expect(el.querySelector('[data-field="name"]')).toBeNull();
  });

  it('leaves the 5xx toast to the interceptor (no second toast) when loading fails', () => {
    service.getById.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: '系統發生未預期的錯誤，請稍後再試' } })),
    );
    const add = spyOn(TestBed.inject(MessageService), 'add');
    create('4');
    expect(add).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(fixture.componentInstance.notFound()).toBeTrue();
  });

  it('edit() navigates to the edit page; back() to the list', () => {
    create('4');
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture.componentInstance.edit();
    expect(router.navigate).toHaveBeenCalledWith(['/partners', '4', 'edit']);

    fixture.componentInstance.back();
    expect(router.navigate).toHaveBeenCalledWith(['/partners']);
  });

  it('shows the 異動紀錄 badge for this record in the page header', () => {
    const el = create('4');
    expect(el.querySelector('.page-header .start app-row-audit-badge')).not.toBeNull();
    expect(TestBed.inject(RowAuditService).getHistory).toHaveBeenCalledOnceWith('Partner', '4');
  });
});
