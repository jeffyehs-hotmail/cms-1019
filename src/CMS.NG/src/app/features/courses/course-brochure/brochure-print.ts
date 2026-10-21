import { BROCHURE_COMPANY, FOOTER_TITLE_MAX } from './course-brochure.config';

/** Cuts `title` to `max` characters (code points, so emoji are never split) and adds "…". */
export function truncateTitle(title: string, max = FOOTER_TITLE_MAX): string {
  const chars = Array.from(title);
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : title;
}

/** `BROCHURE_COMPANY · 課程名稱 · yyyy/MM/dd` for the page footer (design review D15). `today` is `yyyy-MM-dd`. */
export function brochureFooterText(title: string, today: string): string {
  return `${BROCHURE_COMPANY} · ${truncateTitle(title)} · ${today.replaceAll('-', '/')}`;
}

/**
 * A CSS string literal for `--brochure-footer`, consumed by `content: var(...)` in an @page margin box.
 * Control characters are dropped and `\` / `"` escaped, so any 課程名稱 stays one valid string token (eng F8).
 */
export function toCssString(text: string): string {
  const clean = Array.from(text)
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      return c >= 0x20 && !(c >= 0x7f && c <= 0x9f);
    })
    .join('');
  return `"${clean.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** File-name-safe document title (Chrome uses it as the default PDF name): Windows-reserved characters → `_`. */
export function printTitle(courseId: string): string {
  return courseId.replace(/[\\/:*?"<>|]/g, '_');
}
