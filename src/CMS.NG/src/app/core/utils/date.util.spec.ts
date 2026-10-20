import { addDays, parseIsoDate, startOfWeek, toIsoDate } from './date.util';

describe('date.util', () => {
  it('toIsoDate uses local components (no UTC shift at local midnight)', () => {
    expect(toIsoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(toIsoDate(new Date(2027, 11, 31, 23, 59))).toBe('2027-12-31');
  });

  it('parseIsoDate returns local midnight', () => {
    const d = parseIsoDate('2026-03-09')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(9);
    expect(d.getHours()).toBe(0);
  });

  it('parseIsoDate accepts a datetime string and rejects blanks', () => {
    expect(toIsoDate(parseIsoDate('2026-03-09T00:00:00')!)).toBe('2026-03-09');
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate('bad')).toBeNull();
  });

  it('round-trips', () => {
    expect(toIsoDate(parseIsoDate('2099-12-31')!)).toBe('2099-12-31');
  });

  it('addDays crosses month boundaries at local midnight', () => {
    expect(toIsoDate(addDays(new Date(2026, 2, 30, 15, 0), 3))).toBe('2026-04-02');
    expect(toIsoDate(addDays(new Date(2026, 2, 1), -1))).toBe('2026-02-28');
    expect(addDays(new Date(2026, 2, 30, 15, 0), 0).getHours()).toBe(0);
  });

  it('startOfWeek returns the Monday (Sunday belongs to the previous Monday)', () => {
    expect(toIsoDate(startOfWeek(new Date(2026, 2, 16)))).toBe('2026-03-16'); // Mon
    expect(toIsoDate(startOfWeek(new Date(2026, 2, 18)))).toBe('2026-03-16'); // Wed
    expect(toIsoDate(startOfWeek(new Date(2026, 2, 22)))).toBe('2026-03-16'); // Sun
    expect(toIsoDate(startOfWeek(new Date(2026, 2, 23)))).toBe('2026-03-23'); // next Mon
  });
});
