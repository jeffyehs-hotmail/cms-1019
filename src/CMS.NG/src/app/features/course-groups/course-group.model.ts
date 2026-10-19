/** CourseGroup response model (課程群組). `pkid` is a smallint IDENTITY. */
export interface CourseGroup {
  pkid: number;
  description: string;
  /** Course rows referencing this group. */
  courseCount: number;
  /** PartnerCourseGroup rows referencing this group. */
  partnerCourseGroupCount: number;
}

/** Write DTO for POST / PUT. `pkid` ignored on POST; required on PUT. */
export interface CourseGroupRequest {
  pkid?: number;
  description: string;
}

export interface CourseGroupQuery {
  keyword?: string | null;
}
