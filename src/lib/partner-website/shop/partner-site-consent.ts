'use client'

/**
 * S0.9 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — consent cookie/tracking cho trang shop
 * công khai. Lưu theo TỪNG shop (`siteSlug`) — các shop khác nhau trên cùng domain platform
 * (`/site/{slug}`) KHÔNG được share cùng 1 trạng thái consent trong localStorage.
 */

export type PartnerSiteConsentChoice = 'accepted' | 'rejected'

export const PARTNER_SITE_CONSENT_CHANGED_EVENT = 'pw-consent-changed'

function storageKey(siteSlug: string): string {
  return `pw_shop_cookie_consent:${siteSlug.trim().toLowerCase()}`
}

export function getPartnerSiteConsent(siteSlug: string): PartnerSiteConsentChoice | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(siteSlug))
    return raw === 'accepted' || raw === 'rejected' ? raw : null
  } catch {
    return null
  }
}

export function setPartnerSiteConsent(siteSlug: string, choice: PartnerSiteConsentChoice): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(siteSlug), choice)
  } catch {
    // Safari private mode / storage quota — bỏ qua, coi như chưa quyết định lần sau.
  }
  window.dispatchEvent(new CustomEvent(PARTNER_SITE_CONSENT_CHANGED_EVENT, { detail: { siteSlug, choice } }))
}
