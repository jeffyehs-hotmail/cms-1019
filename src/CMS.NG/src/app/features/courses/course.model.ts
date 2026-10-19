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

/** True when CourseFAQ / CourseRelatedLink / HotCourse rows reference the course (delete → 409). */
export function courseInUse(c: Course): boolean {
  return c.courseFaqCount + c.courseRelatedLinkCount + c.hotCourseCount > 0;
}
