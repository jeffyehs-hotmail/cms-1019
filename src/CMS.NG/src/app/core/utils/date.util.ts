/**
 * `yyyy-MM-dd` from a Date using **local** date components.
 * Never `toISOString()` — that converts to UTC first and shifts the day for UTC+8 users.
 */
export function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Local-midnight Date from a `yyyy-MM-dd` (or `yyyy-MM-ddT…`) string; null when blank or malformed. */
export function parseIsoDate(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
