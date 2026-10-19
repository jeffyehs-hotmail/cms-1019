/** Partner response model (原廠). `pkid` is a smallint IDENTITY. */
export interface Partner {
  pkid: number;
  name: string;
  appKey: string;
  nameOnPartnerMenu: string;
  nameOnCourseDetailPage: string;
  displayOrder: number;
  imageFilename: string | null;
  /** Course rows referencing this partner. */
  courseCount: number;
  /** Certification rows referencing this partner. */
  certificationCount: number;
  /** PartnerCourseGroup rows referencing this partner. */
  partnerCourseGroupCount: number;
  /** Promotion2 rows referencing this partner (RelatedPartner_pkid). */
  promotion2Count: number;
  /** Seminar rows referencing this partner (no FK constraint). */
  seminarCount: number;
}

/** Write DTO for POST / PUT. `pkid` ignored on POST; required on PUT. */
export interface PartnerRequest {
  pkid?: number;
  name: string;
  appKey: string;
  nameOnPartnerMenu: string;
  nameOnCourseDetailPage: string;
  displayOrder: number;
  imageFilename: string | null;
}

export interface PartnerQuery {
  keyword?: string | null;
}
