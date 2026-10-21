import { Course } from '../course.model';

// Brochure settings in one place, so the rep's Word sample can retune them (T5).
// Every value below is provisional until that sample is saved under spec/course/brochure/.

/** Company line at the top of the brochure and in the page footer (design review D11). Confirm the exact name. */
export const BROCHURE_COMPANY = '恆逸教育訓練中心';

/**
 * Closing contact block, the customer's next step even when the QR is omitted (autoplan design H1).
 * Empty entries are not printed.
 */
export const BROCHURE_CONTACT: { label: string; value: string }[] = [
  { label: '網站', value: 'www.uuu.com.tw' },
  { label: '電話', value: '' },
  { label: 'Email', value: '' },
];

/** Section order in the brochure: customer order, not the detail page's admin order (design review D4). */
export const BROCHURE_SECTIONS: { key: keyof Course; label: string }[] = [
  { key: 'objective', label: '課程目標' },
  { key: 'target', label: '適合對象' },
  { key: 'prerequisites', label: '預備知識' },
  { key: 'outline', label: '課程大綱' },
  { key: 'towardCertOrExam', label: '相關認證／考試' },
  { key: 'material', label: '教材' },
  { key: 'note', label: '備註' },
  { key: 'otherInfo', label: '其他資訊' },
];

/** 定價 stays off the brochure until the sample shows it (D12). */
export const SHOW_PRICE = false;

/** 課程名稱 longer than this is cut with "…" in the page footer so the margin box never overflows (autoplan design P1). */
export const FOOTER_TITLE_MAX = 30;
