import { parseIsoDate, toIsoDate } from './date.util';

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
});
