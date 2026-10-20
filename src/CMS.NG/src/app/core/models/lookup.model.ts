/** Slim AppUser from GET /api/lookups/app-users. */
export interface AppUserLookup {
  pkid: number;
  userId: string;
  userName: string;
}

/** Slim AppRole from GET /api/lookups/app-roles (ordered by RoleId). */
export interface AppRoleLookup {
  pkid: number;
  roleId: string;
  roleName: string;
}

/** Slim TrainingCenter from GET /api/lookups/training-centers (ordered by DisplayOrder). */
export interface TrainingCenterLookup {
  pkid: number;
  name: string;
}

/** Promotion2 match from GET /api/lookups/promotions?keyword= (PromoCode autocomplete). */
export interface PromotionLookup {
  pkid: number;
  promoCode: string;
  topic: string;
  description: string;
}

/** Slim PublishStatus from GET /api/lookups/publish-statuses (ordered by pkid). */
export interface PublishStatusLookup {
  pkid: number;
  description: string;
}

/** Slim Partner from GET /api/lookups/partners (ordered by DisplayOrder, Name). */
export interface PartnerLookup {
  pkid: number;
  name: string;
}

/** Slim CourseGroup from GET /api/lookups/course-groups (ordered by Description). */
export interface CourseGroupLookup {
  pkid: number;
  description: string;
}

/** Slim Certification from GET /api/lookups/certifications (ordered by partner, then title). */
export interface CertificationLookup {
  pkid: number;
  title: string;
  partnerName: string;
}

/** Slim JobCategory from GET /api/lookups/job-categories (ordered by Description). */
export interface JobCategoryLookup {
  pkid: number;
  description: string;
}

/** Slim Course from GET /api/lookups/courses (ordered by CourseId). */
export interface CourseLookup {
  pkid: number;
  courseId: string;
  title: string;
}
