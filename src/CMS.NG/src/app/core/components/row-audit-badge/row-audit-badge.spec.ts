import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { RowAuditBadge } from './row-audit-badge';
import { RowAuditEntry, RowAuditService } from './row-audit.service';

describe('RowAuditBadge', () => {
  let fixture: ComponentFixture<RowAuditBadge>;
  let service: jasmine.SpyObj<RowAuditService>;

  const base: RowAuditEntry = { dateTime: '2026-06-01T09:00:00', userName: 'alice', actionType: 'Insert', actionDesc: 'AZ-900' };
  const latest: RowAuditEntry = { ...base, dateTime: '2026-06-04T14:30:00', userName: 'bob', actionType: 'Update', actionDesc: 'Title,ListPrice' };
  const middle: RowAuditEntry = { ...base, dateTime: '2026-06-02T10:00:00', userName: 'carol', actionType: 'Update', actionDesc: 'DisplayOrder' };
  const first: RowAuditEntry = { ...base };
  const trail = [latest, middle, first];

  function create(tableName = 'Course', pkid: string | number = '123'): HTMLElement {
    fixture = TestBed.createComponent(RowAuditBadge);
    fixture.componentRef.setInput('tableName', tableName);
    fixture.componentRef.setInput('pkid', pkid);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const latestText = (el: HTMLElement) =>
    el.querySelector('[data-row-audit-latest]')!.textContent!.replace(/\s+/g, ' ').trim();

  function click(el: HTMLElement): void {
    el.querySelector<HTMLButtonElement>('[data-row-audit-badge]')!.click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj<RowAuditService>('RowAuditService', ['getHistory']);
    service.getHistory.and.callFake(() => of([...trail]));

    await TestBed.configureTestingModule({
      imports: [RowAuditBadge],
      providers: [provideNoopAnimations(), { provide: RowAuditService, useValue: service }],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    // p-dialog is appended to <body>; drop leftovers so the next test only sees its own dialog.
    document.body.querySelectorAll('.p-dialog-mask, .p-dialog').forEach((e) => e.remove());
  });

  it('loads the record history and shows the latest row inline with the bilingual label', () => {
    const el = create('Course', '123');

    expect(service.getHistory).toHaveBeenCalledOnceWith('Course', '123');
    expect(el.querySelector('[data-row-audit-badge]')!.textContent).toContain('異動紀錄 History');
    expect(latestText(el)).toBe('Update by bob · 2026-06-04 14:30');
  });

  it('is a non-submitting button, so it can sit inside a form', () => {
    const el = create();
    expect(el.querySelector('button')!.getAttribute('type')).toBe('button');
  });

  it('opens a dialog with the full trail, newest first', () => {
    const el = create();
    expect(document.body.querySelector('[data-row-audit-table]')).toBeNull();

    click(el);

    expect(service.getHistory).toHaveBeenCalledTimes(2);
    const rows = Array.from(document.body.querySelectorAll('[data-row-audit-row]'));
    expect(rows.length).toBe(3);
    const cells = (r: Element) => Array.from(r.querySelectorAll('td')).map((td) => td.textContent!.trim());
    expect(cells(rows[0])).toEqual(['2026-06-04 14:30:00', 'bob', 'Update', 'Title,ListPrice']);
    expect(cells(rows[1])).toEqual(['2026-06-02 10:00:00', 'carol', 'Update', 'DisplayOrder']);
    expect(cells(rows[2])).toEqual(['2026-06-01 09:00:00', 'alice', 'Insert', 'AZ-900']);
    expect(document.body.textContent).toContain('時間 DateTime');
  });

  it('shows a neutral "no history" state on the badge and in the dialog when empty', () => {
    service.getHistory.and.returnValue(of([]));
    const el = create();

    expect(latestText(el)).toBe('尚無紀錄 No history');

    click(el);

    expect(document.body.querySelector('[data-row-audit-empty]')!.textContent).toContain('尚無異動紀錄 No history yet');
    expect(document.body.querySelector('[data-row-audit-row]')).toBeNull();
  });

  it('shows a load failure without throwing', () => {
    service.getHistory.and.returnValue(throwError(() => new Error('boom')));
    const el = create();
    expect(latestText(el)).toBe('無法載入');
  });

  it('reloads when the pkid input changes', () => {
    create('CourseGroup', 7);
    service.getHistory.and.returnValue(of([middle]));

    fixture.componentRef.setInput('pkid', 8);
    fixture.detectChanges();

    expect(service.getHistory).toHaveBeenCalledWith('CourseGroup', 8);
    expect(latestText(fixture.nativeElement)).toBe('Update by carol · 2026-06-02 10:00');
  });
});
