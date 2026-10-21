// Regression: ISSUE-001 — Partner list row actions scrolled off-screen at 1280px (操作 column not pinned)
// Found by /qa on 2026-10-21
// Report: .gstack/qa-reports/qa-report-localhost-2026-10-21.md
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Partner } from '../partner.model';
import { PartnerService } from '../partner.service';
import { PartnerList } from './partner-list';

describe('PartnerList (regression ISSUE-001)', () => {
  const partner: Partner = {
    pkid: 1, name: 'Microsoft', appKey: 'ms', nameOnPartnerMenu: 'Microsoft 微軟', nameOnCourseDetailPage: '微軟',
    displayOrder: 2001, imageFilename: 'ms.png',
    courseCount: 0, certificationCount: 0, partnerCourseGroupCount: 0, promotion2Count: 0, seminarCount: 0,
  };

  beforeEach(async () => {
    sessionStorage.clear();
    const service = jasmine.createSpyObj<PartnerService>('PartnerService', ['query', 'delete']);
    service.query.and.returnValue(of([partner]));

    await TestBed.configureTestingModule({
      imports: [PartnerList],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        ConfirmationService,
        MessageService,
        { provide: PartnerService, useValue: service },
      ],
    }).compileComponents();
  });

  afterEach(() => sessionStorage.clear());

  it('pins the 操作 column to the right edge so row actions stay visible', async () => {
    const fixture = TestBed.createComponent(PartnerList);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const th = el.querySelector('thead th.col-actions') as HTMLElement;
    const td = el.querySelector('tbody td.col-actions') as HTMLElement;

    for (const cell of [th, td]) {
      expect(cell.classList).toContain('p-datatable-frozen-column');
      expect(getComputedStyle(cell).position).toBe('sticky');
    }
  });
});
