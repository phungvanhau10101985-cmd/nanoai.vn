/** Session key for a promo code applied from a Thêm coupon widget — cart page reads it. */

export function partnerSiteAppliedPromoStorageKey(siteSlug: string): string {
  return `pw-applied-promo:${siteSlug.trim().toLowerCase()}`
}
