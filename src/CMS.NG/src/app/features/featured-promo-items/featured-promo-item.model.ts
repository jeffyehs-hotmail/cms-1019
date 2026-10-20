/** Slots per day and training center. */
export const MAX_SLOT = 3;

/** FeaturedPromoItem response model (首頁上稿). `scheduleOn` is `yyyy-MM-dd`. */
export interface FeaturedPromoItem {
  pkid: number;
  scheduleOn: string;
  trainingCenterPkid: number;
  trainingCenterName: string;
  slot: number;
  promotionPkid: number;
  promoCode: string;
  topic: string;
  description: string;
}

/** Write DTO for POST / PUT (`pkid` required on PUT). */
export interface FeaturedPromoItemRequest {
  pkid: number;
  scheduleOn: string;
  trainingCenterPkid: number;
  slot: number;
  promotionPkid: number;
  topic: string;
  description: string;
}

/** One Monday–Sunday week; the server widens `weekOf` to the whole week. */
export interface FeaturedPromoItemQuery {
  trainingCenterPkid: number | null;
  weekOf: string;
}

/** The part of an item that Copy / Paste carries between slots. */
export interface PromoContent {
  promotionPkid: number;
  promoCode: string;
  topic: string;
  description: string;
}
