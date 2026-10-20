import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { LookupService } from '../../../core/services/lookup.service';
import { AgentTokenUsage, currentTaipeiMonth } from '../agent-token-usage.model';
import { AgentTokenUsageService } from '../agent-token-usage.service';
import { toIsoDate } from '../../../core/utils/date.util';
import { AgentTokenUsageReport, FILTERS_KEY } from './agent-token-usage-report';

describe('AgentTokenUsageReport', () => {
  let fixture: ComponentFixture<AgentTokenUsageReport>;
  let service: jasmine.SpyObj<AgentTokenUsageService>;
  let lookups: jasmine.SpyObj<LookupService>;
  let messages: MessageService;

  const base: AgentTokenUsage = {
    usageDate: '2026-10-20',
    userId: 'alice',
    userName: 'Alice',
    project: 'cms-1019',
    model: 'claude-opus-5-5',
    sessionId: null,
    sessionName: null,
    sessionCount: 2,
    inputTokens: 1000,
    outputTokens: 2000,
    cacheWrite5mTokens: 300,
    cacheWrite1hTokens: 400,
    cacheReadTokens: 5000,
    cost: 1.23456,
    hasUnpricedRows: false,
  };
  const opus: AgentTokenUsage = { ...base };
  const unpriced: AgentTokenUsage = { ...base, model: 'claude-new', sessionCount: 1, cost: null, hasUnpricedRows: true };

  function create(): HTMLElement {
    fixture = TestBed.createComponent(AgentTokenUsageReport);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    sessionStorage.removeItem(FILTERS_KEY);
    service = jasmine.createSpyObj<AgentTokenUsageService>('AgentTokenUsageService', ['query', 'getFilterOptions']);
    service.query.and.callFake(() => of([{ ...opus }, { ...unpriced }]));
    service.getFilterOptions.and.returnValue(of({ projects: ['cms-1019'], models: ['claude-opus-5-5'] }));
    lookups = jasmine.createSpyObj<LookupService>('LookupService', ['getAppUsers']);
    lookups.getAppUsers.and.returnValue(of([{ pkid: 1, userId: 'alice', userName: 'Alice' }]));

    await TestBed.configureTestingModule({
      imports: [AgentTokenUsageReport],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: AgentTokenUsageService, useValue: service },
        { provide: LookupService, useValue: lookups },
      ],
    }).compileComponents();

    messages = TestBed.inject(MessageService);
  });

  afterEach(() => sessionStorage.removeItem(FILTERS_KEY));

  it('queries the current Taipei month by default and loads the filter options', () => {
    create();
    const { from, to } = currentTaipeiMonth();

    expect(service.query).toHaveBeenCalledOnceWith({
      from: toIsoDate(from),
      to: toIsoDate(to),
      userIds: [],
      projects: [],
      models: [],
      groupBySession: false,
    });
    expect(fixture.componentInstance.userOptions()).toEqual([{ value: 'alice', label: 'Alice (alice)' }]);
    expect(fixture.componentInstance.projects()).toEqual(['cms-1019']);
  });

  it('renders a row per group with cache write and token-in sums, and flags unpriced cost', () => {
    const el = create();
    const rows = el.querySelectorAll('tr[data-row]');

    expect(rows.length).toBe(2);
    const cells = Array.from(rows[0].querySelectorAll('td')).map((td) => td.textContent?.trim());
    expect(cells.slice(0, 4)).toEqual(['2026-10-20', 'Alice (alice)', 'cms-1019', 'claude-opus-5-5']);
    expect(cells[6]).toBe('700'); // cache write 5m + 1h
    expect(cells[8]).toBe('6,700'); // input + cache writes + cache reads
    expect(cells[10]).toBe('1.2346');
    expect(rows[1].querySelector('[data-field="cost"]')?.textContent?.trim()).toBe('未定價');
  });

  it('renders the grand total row', () => {
    const el = create();
    const totals = el.querySelector('tr[data-totals]')!;
    const cells = Array.from(totals.querySelectorAll('td')).map((td) => td.textContent?.trim());

    expect(cells[0]).toBe('合計');
    expect(cells[1]).toBe('3'); // sessions
    expect(cells[5]).toBe('13,400'); // token in
    expect(cells[7]).toContain('1.2346');
    expect(cells[7]).toContain('未定價');
  });

  it('search() applies the draft filters, saves them and reloads', () => {
    create();
    service.query.calls.reset();
    const c = fixture.componentInstance;
    c.draft = {
      range: [new Date(2026, 8, 1), new Date(2026, 8, 30)],
      userIds: ['alice'],
      projects: ['cms-1019'],
      models: [],
      groupBySession: true,
    };

    c.search();

    const expected = {
      from: '2026-09-01',
      to: '2026-09-30',
      userIds: ['alice'],
      projects: ['cms-1019'],
      models: [],
      groupBySession: true,
    };
    expect(service.query).toHaveBeenCalledOnceWith(expected);
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!)).toEqual(expected);
  });

  it('search() with a single picked day queries that day only, and warns without a date', () => {
    create();
    service.query.calls.reset();
    const c = fixture.componentInstance;
    const warn = spyOn(messages, 'add');

    c.draft = { ...c.draft, range: [new Date(2026, 9, 5)] };
    c.search();
    expect(service.query.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ from: '2026-10-05', to: '2026-10-05' }));

    service.query.calls.reset();
    c.draft = { ...c.draft, range: null };
    c.search();
    expect(service.query).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn' }));
  });

  it('restores saved filters from the session; reset() goes back to this month', () => {
    sessionStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({ from: '2026-01-01', to: '2026-01-31', userIds: ['bob'], projects: [], models: ['m'] }),
    );
    create();
    expect(service.query.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ from: '2026-01-01', userIds: ['bob'], models: ['m'] }),
    );

    fixture.componentInstance.reset();
    const { from } = currentTaipeiMonth();
    expect(service.query.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ from: toIsoDate(from), userIds: [], models: [] }),
    );
  });

  it('toasts the API message when the query fails', () => {
    service.query.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { message: '起始日期不可晚於結束日期' } })),
    );
    const add = spyOn(messages, 'add');
    create();

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '起始日期不可晚於結束日期' }));
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('leaves the 5xx toast to the interceptor (no second toast) when the query fails', () => {
    service.query.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: '系統發生未預期的錯誤，請稍後再試' } })),
    );
    const add = spyOn(messages, 'add');
    create();

    expect(add).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('shows the empty message without a totals row', () => {
    service.query.and.returnValue(of([]));
    const el = create();

    expect(el.textContent).toContain('此條件下沒有 Token 用量資料');
    expect(el.querySelector('tr[data-totals]')).toBeNull();
  });

  it('shows the session column only when grouped by session, with a fallback for unnamed sessions', () => {
    let el = create();
    expect(el.querySelector('[data-field="session"]')).toBeNull();
    expect(el.querySelector('tr[data-totals] td')?.getAttribute('colspan')).toBe('4');

    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ groupBySession: true }));
    service.query.and.callFake(() =>
      of([
        { ...opus, sessionId: 'aaaaaaaa-1111', sessionName: 'token report', sessionCount: 1 },
        { ...unpriced, sessionId: 'bbbbbbbb-2222', sessionName: null },
      ]),
    );
    el = create();

    expect(service.query.calls.mostRecent().args[0].groupBySession).toBeTrue();
    const cells = el.querySelectorAll('[data-field="session"]');
    expect(cells[0].textContent?.trim()).toBe('token report');
    expect(cells[0].getAttribute('title')).toBe('aaaaaaaa-1111');
    expect(cells[1].textContent?.trim()).toBe('（未命名）bbbbbbbb');
    expect(el.querySelector('tr[data-totals] td')?.getAttribute('colspan')).toBe('5');
  });
});
