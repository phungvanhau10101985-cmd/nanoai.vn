/** localStorage key cho banner cookie shop. Cùng chuỗi ở snippet GA4 trong `<head>`. */
export function partnerSiteConsentStorageKey(siteSlug: string): string {
  return `pw_shop_cookie_consent:${siteSlug.trim().toLowerCase()}`
}
