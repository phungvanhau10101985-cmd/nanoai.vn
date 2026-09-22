import {
  htmlHasMarketplaceLook,
  isMarketplaceLook,
  PARTNER_WEBSITE_LOOK_MARKETPLACE,
  resolvePartnerWebsiteLook,
} from '@/lib/partner-website/shop/marketplace-shop-look-css'
import {
  DEFAULT_PARTNER_WEBSITE_THEME,
  type PartnerWebsiteTheme,
} from '@/lib/partner-website/template/partner-website-template-types'

/** Bump when the live CSS pack contents change so HTML cache + `?v=` cannot reuse a stale sheet. */
export const PARTNER_SHOP_LIVE_CSS_PACK_VERSION = '1'
export const PARTNER_SHOP_LIVE_CSS_LINK_ID = 'pw-shop-live-css'
export const PARTNER_SHOP_LIVE_HTML_CACHE_EXTRA = 'css-href-1'

/**
 * Cache-busting fingerprint (not cryptographic).
 * Must not import `partner-shop-cache` / Redis / `node:crypto` — webpack traces
 * this file into the shop React shell client.
 */
function hashLiveCssPayload(value: unknown): string {
  const text = JSON.stringify(value)
  let h1 = 2166136261
  let h2 = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i)
    h1 ^= c
    h1 = Math.imul(h1, 16777619)
    h2 = Math.imul(h2 ^ c, 16777619)
  }
  return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')).slice(
    0,
    16
  )
}

export function resolvedLiveTheme(
  theme?: PartnerWebsiteTheme | null,
  html?: string
): PartnerWebsiteTheme {
  const look = resolvePartnerWebsiteLook(theme, html)
  const marketplace =
    look === PARTNER_WEBSITE_LOOK_MARKETPLACE ||
    isMarketplaceLook(theme) ||
    htmlHasMarketplaceLook(html || '')
  return marketplace && !isMarketplaceLook(theme)
    ? { ...(theme || DEFAULT_PARTNER_WEBSITE_THEME), look: PARTNER_WEBSITE_LOOK_MARKETPLACE }
    : { ...(theme || DEFAULT_PARTNER_WEBSITE_THEME), look }
}

export function partnerShopLiveCssVersion(theme?: PartnerWebsiteTheme | null, html?: string): string {
  const resolved = resolvedLiveTheme(theme, html)
  return hashLiveCssPayload({
    v: PARTNER_SHOP_LIVE_CSS_PACK_VERSION,
    look: resolved.look || 'shop',
    primaryColor: resolved.primaryColor,
    accentColor: resolved.accentColor,
    backgroundColor: resolved.backgroundColor,
    textColor: resolved.textColor,
    mutedColor: resolved.mutedColor,
    buyButtonColor: resolved.buyButtonColor || '',
    cartButtonColor: resolved.cartButtonColor || '',
    surfaceColor: resolved.surfaceColor || '',
    footerColor: resolved.footerColor || '',
    borderColor: resolved.borderColor || '',
    fontFamily: resolved.fontFamily,
  })
}

export function partnerShopLiveCssHref(
  siteSlug: string,
  theme?: PartnerWebsiteTheme | null,
  html?: string
): string {
  const slug = siteSlug.trim()
  const v = partnerShopLiveCssVersion(theme, html)
  return `/api/site/${encodeURIComponent(slug)}/shop-theme.css?v=${v}`
}
