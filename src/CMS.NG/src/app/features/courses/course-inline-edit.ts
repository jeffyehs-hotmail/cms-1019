import { toIsoDate } from '../../core/utils/date.util';
import { Course, CourseRequest } from './course.model';

/**
 * Course list columns that can be edited in place. `pkid` and the FK lookup columns
 * (原廠 / 課程群組) are deliberately absent.
 */
export const EDITABLE_FIELDS = [
  'displayOrder',
  'courseId',
  'prodCourseId',
  'title',
  'publishStatusPkid',
  'scheduleOn',
  'scheduleOff',
  'hour',
  'listPrice',
  'learningCredit',
  'canRepeat',
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

export type CellValidation =
  | { ok: true; value: Course[EditableField] }
  | { ok: false; error: string };

const ASCII = /^[\x20-\x7E]*$/;

const LABELS: Record<EditableField, string> = {
  displayOrder: '顯示順序',
  courseId: '簡介代碼',
  prodCourseId: '科目代碼',
  title: '課程名稱',
  publishStatusPkid: '上架狀態',
  scheduleOn: '上架日期',
  scheduleOff: '下架日期',
  hour: '時數',
  listPrice: '定價',
  learningCredit: '點數',
  canRepeat: '允許重聽',
};

export function fieldLabel(field: EditableField): string {
  return LABELS[field];
}

const fail = (error: string): CellValidation => ({ ok: false, error });
const pass = (value: Course[EditableField]): CellValidation => ({ ok: true, value });

function text(field: EditableField, raw: unknown, max: number, ascii: boolean): CellValidation {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return fail(`請輸入${LABELS[field]}`);
  if (s.length > max) return fail(`最多 ${max} 字`);
  if (ascii && !ASCII.test(s)) return fail('僅限英數字元');
  return pass(s);
}

function num(field: EditableField, raw: unknown, opts: { min?: number; max?: number; decimals: number }): CellValidation {
  if (raw === null || raw === undefined || raw === '') return fail(`請輸入${LABELS[field]}`);
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return fail(`${LABELS[field]}須為數字`);
  if (opts.min !== undefined && n < opts.min) return fail(`${LABELS[field]}不可為負數`);
  if (opts.max !== undefined && n > opts.max) return fail(`${LABELS[field]}不可超過 ${opts.max}`);
  const scaled = n * 10 ** opts.decimals;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-9) {
    return fail(opts.decimals === 0 ? `${LABELS[field]}須為整數` : `${LABELS[field]}最多${opts.decimals}位小數`);
  }
  return pass(n);
}

function isoDate(field: EditableField, raw: unknown): CellValidation {
  if (raw === null || raw === undefined || raw === '') return fail(`請輸入${LABELS[field]}`);
  if (!(raw instanceof Date) || Number.isNaN(raw.getTime())) return fail('日期格式不正確');
  return pass(toIsoDate(raw));
}

/**
 * Validates a raw editor value for one cell against the same rules as the Course form and API.
 * `row` supplies the other date for the 上架日期 ≤ 下架日期 check. On success `value` is in the
 * `Course` representation (dates as `yyyy-MM-dd`, trimmed strings).
 */
export function validateCell(field: EditableField, raw: unknown, row: Course): CellValidation {
  switch (field) {
    case 'title':
      return text(field, raw, 200, false);
    case 'courseId':
    case 'prodCourseId':
      return text(field, raw, 50, true);
    case 'displayOrder':
      return num(field, raw, { min: -2147483648, max: 2147483647, decimals: 0 });
    case 'hour':
      return num(field, raw, { min: 0, max: 32767, decimals: 0 });
    case 'listPrice':
      return num(field, raw, { min: 0, max: 999999999, decimals: 0 });
    case 'learningCredit':
      return num(field, raw, { min: 0, max: 99999999.9, decimals: 1 });
    case 'publishStatusPkid': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      return raw !== null && raw !== undefined && Number.isInteger(n) && n > 0 ? pass(n) : fail('請選擇上架狀態');
    }
    case 'scheduleOn':
    case 'scheduleOff': {
      const r = isoDate(field, raw);
      if (!r.ok) return r;
      const on = field === 'scheduleOn' ? (r.value as string) : row.scheduleOn;
      const off = field === 'scheduleOff' ? (r.value as string) : row.scheduleOff;
      if (on && off && off < on) return fail('下架日期不可早於上架日期');
      return r;
    }
    case 'canRepeat':
      return pass(!!raw);
  }
}

/**
 * Full PUT payload from a complete Course (GET by id, which carries the long texts and n-n
 * arrays the list rows omit) with one or more fields replaced.
 */
export function toCourseRequest(full: Course, patch: Partial<Course>): CourseRequest {
  const c = { ...full, ...patch };
  return {
    pkid: c.pkid,
    title: c.title,
    officialTitle: c.officialTitle,
    courseId: c.courseId,
    prodCourseId: c.prodCourseId,
    friendlyUrl: c.friendlyUrl,
    displayOrder: c.displayOrder,
    partnerPkid: c.partnerPkid,
    courseGroupPkid: c.courseGroupPkid,
    publishStatusPkid: c.publishStatusPkid,
    scheduleOn: c.scheduleOn,
    scheduleOff: c.scheduleOff,
    hour: c.hour,
    listPrice: c.listPrice,
    learningCredit: c.learningCredit,
    canRepeat: c.canRepeat,
    material: c.material,
    objective: c.objective,
    target: c.target,
    prerequisites: c.prerequisites,
    outline: c.outline,
    towardCertOrExam: c.towardCertOrExam,
    note: c.note,
    otherInfo: c.otherInfo,
    certificationPkids: (c.certifications ?? []).map((x) => x.pkid),
    jobCategoryPkids: (c.jobCategories ?? []).map((x) => x.pkid),
  };
}
