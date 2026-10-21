import { CertificationLookup, JobCategoryLookup } from '../../core/models/lookup.model';

/**
 * Course response model (課程). `pkid` is an int IDENTITY. Dates are `yyyy-MM-dd`.
 * List results leave the long-text fields null and the n-n arrays empty.
 */
export interface Course {
  pkid: number;
  title: string;
  officialTitle: string | null;
  courseId: string;
  prodCourseId: string;
  friendlyUrl: string;
  displayOrder: number;
  partnerPkid: number;
  partnerName: string;
  courseGroupPkid: number | null;
  courseGroupDescription: string | null;
  publishStatusPkid: number;
  publishStatusDescription: string;
  /** PublishStatus.IsPublished (JOIN). The brochure omits the QR code when false. */
  publishStatusIsPublished: boolean;
  scheduleOn: string;
  scheduleOff: string;
  hour: number;
  listPrice: number;
  learningCredit: number;
  canRepeat: boolean;
  material: string | null;
  objective: string | null;
  target: string | null;
  prerequisites: string | null;
  outline: string | null;
  towardCertOrExam: string | null;
  note: string | null;
  otherInfo: string | null;
  /** CourseFAQ rows referencing this course. */
  courseFaqCount: number;
  /** CourseRelatedLink rows referencing this course. */
  courseRelatedLinkCount: number;
  /** HotCourse rows referencing this course. */
  hotCourseCount: number;
  /** n-n CourseInCertification (GET by id only). */
  certifications: CertificationLookup[];
  /** n-n CourseJobCategories (GET by id only). */
  jobCategories: JobCategoryLookup[];
}

/** Write DTO for POST / PUT. `pkid` ignored on POST; required on PUT. */
export interface CourseRequest {
  pkid?: number;
  title: string;
  officialTitle: string | null;
  courseId: string;
  prodCourseId: string;
  friendlyUrl: string;
  displayOrder: number;
  partnerPkid: number;
  courseGroupPkid: number | null;
  publishStatusPkid: number;
  scheduleOn: string;
  scheduleOff: string;
  hour: number;
  listPrice: number;
  learningCredit: number;
  canRepeat: boolean;
  material: string | null;
  objective: string | null;
  target: string | null;
  prerequisites: string | null;
  outline: string | null;
  towardCertOrExam: string | null;
  note: string | null;
  otherInfo: string | null;
  certificationPkids: number[];
  jobCategoryPkids: number[];
}

export interface CourseQuery {
  keyword?: string | null;
  partnerPkid?: number | null;
  courseGroupPkid?: number | null;
  publishStatusPkid?: number | null;
  scheduleOnFrom?: string | null;
  scheduleOnTo?: string | null;
  scheduleOffFrom?: string | null;
  scheduleOffTo?: string | null;
  canRepeat?: boolean | null;
}

/** Public course page on the website, encoded in the course QR codes. */
export const COURSE_SITE_URL = 'https://www.uuu.com.tw/Course/Show';

/** https://www.uuu.com.tw/Course/Show/{pkid}/{CourseId} (CourseId URL-encoded). */
export function courseUrl(c: Course): string {
  return `${COURSE_SITE_URL}/${c.pkid}/${encodeURIComponent(c.courseId)}`;
}

/** Long-text fields shown in the detail page's 課程內容 card, in display order. */
export const TEXT_FIELDS: { key: keyof Course; label: string }[] = [
  { key: 'material', label: '教材' },
  { key: 'target', label: '適合對象' },
  { key: 'objective', label: '課程目標' },
  { key: 'prerequisites', label: '預備知識' },
  { key: 'outline', label: '課程大綱' },
  { key: 'towardCertOrExam', label: '相關認證／考試' },
  { key: 'note', label: '備註' },
  { key: 'otherInfo', label: '其他資訊' },
];

/**
 * The six long texts that count as course content (備註 / 其他資訊 are notes).
 * The brochure prints its "請洽業務" fallback when none of these has text (eng re-run D25).
 */
export const CONTENT_FIELDS: (keyof Course)[] = [
  'objective',
  'target',
  'prerequisites',
  'outline',
  'towardCertOrExam',
  'material',
];

/** Why the brochure leaves the QR code out, or null when the public page should be live. */
export type QrOmitReason = 'unpublished' | 'expired' | 'notStarted';

/**
 * Shared QR-omit rule for the detail page banner and the brochure (eng re-run D19), checked in D9 order.
 * `today` is a local `yyyy-MM-dd` (`toIsoDate`); boundary days count as live. Compare the strings,
 * never `new Date(c.scheduleOff)` (UTC parse shifts the day in UTC+8).
 */
export function qrOmitReason(c: Course, today: string): QrOmitReason | null {
  if (!c.publishStatusIsPublished) return 'unpublished';
  if (c.scheduleOff < today) return 'expired';
  if (c.scheduleOn > today) return 'notStarted';
  return null;
}

/** True when CourseFAQ / CourseRelatedLink / HotCourse rows reference the course (delete → 409). */
export function courseInUse(c: Course): boolean {
  return c.courseFaqCount + c.courseRelatedLinkCount + c.hotCourseCount > 0;
}
