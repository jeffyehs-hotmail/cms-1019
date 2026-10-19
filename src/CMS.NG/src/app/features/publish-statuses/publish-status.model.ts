/** PublishStatus response model (發布狀態). `pkid` is a user-supplied tinyint, not IDENTITY. */
export interface PublishStatus {
  pkid: number;
  description: string;
  isDraft: boolean;
  isPublished: boolean;
  isDiscontinued: boolean;
  /** Course rows referencing this status. */
  courseCount: number;
  /** Promotion2 rows referencing this status. */
  promotion2Count: number;
}

/** Write DTO for POST / PUT. `pkid` supplied on POST; immutable on PUT. */
export interface PublishStatusRequest {
  pkid: number;
  description: string;
  isDraft: boolean;
  isPublished: boolean;
  isDiscontinued: boolean;
}

export interface PublishStatusQuery {
  keyword?: string | null;
  isDraft?: boolean | null;
  isPublished?: boolean | null;
  isDiscontinued?: boolean | null;
}
