import {
  buildPartnerSiteShopThemeCss,
  PARTNER_SHOP_THEME_STYLE_ID,
} from '@/lib/partner-website/shop/build-shop-theme-css'
import {
  PARTNER_SHOP_CHROME_LAYOUT_CSS,
  PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID,
} from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import {
  buildMarketplaceLookCss,
  MARKETPLACE_GOOGLE_FONTS_HREF,
  scopeMarketplaceLookCss,
  PARTNER_MARKETPLACE_LOOK_STYLE_ID,
  PARTNER_WEBSITE_LOOK_MARKETPLACE,
  stampPartnerWebsiteLookInHtml,
} from '@/lib/partner-website/shop/marketplace-shop-look-css'
import { buildShopLookCss, PARTNER_SHOP_LOOK_STYLE_ID } from '@/lib/partner-website/shop/shop-look-css'
import {
  PW_SHOP_FOOTER_FIT_CSS,
  PW_SHOP_FOOTER_FIT_STYLE_ID,
} from '@/lib/partner-website/shop/partner-site-footer-fit-css'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { upsertShopBrowserThemeColorInHtml } from '@/lib/partner-website/template/partner-website-theme-tokens'
import {
  PARTNER_SHOP_LIVE_CSS_LINK_ID,
  partnerShopLiveCssHref,
  resolvedLiveTheme,
} from '@/lib/partner-website/shop/partner-shop-live-css-href'

export {
  PARTNER_SHOP_LIVE_CSS_LINK_ID,
  PARTNER_SHOP_LIVE_CSS_PACK_VERSION,
  PARTNER_SHOP_LIVE_HTML_CACHE_EXTRA,
  partnerShopLiveCssHref,
  partnerShopLiveCssVersion,
  resolvedLiveTheme,
} from '@/lib/partner-website/shop/partner-shop-live-css-href'

const ENGINE_STYLE_ID_RE = new RegExp(
  `<style\\b[^>]*\\bid=["'](?:${[
    PARTNER_SHOP_THEME_STYLE_ID,
    PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID,
    PARTNER_SHOP_LOOK_STYLE_ID,
    PARTNER_MARKETPLACE_LOOK_STYLE_ID,
    PW_SHOP_FOOTER_FIT_STYLE_ID,
  ].join('|')})["'][^>]*>[\\s\\S]*?<\\/style>`,
  'gi'
)

/** Cuối file CSS live — thắng mọi rule header trắng Desktop/Laptop phía trước. */
function marketplaceHeaderBeatsWideWhiteCss(): string {
  return scopeMarketplaceLookCss(`
html[data-pw-look="marketplace"] .pw-header,
html[data-pw-look="marketplace"] .pw-shop-header,
html[data-pw-look="marketplace"] [data-pw-region="header"],
html[data-pw-look="marketplace"][data-pw-edit-device] .pw-header,
html[data-pw-look="marketplace"][data-pw-edit-device] .pw-shop-header,
html[data-pw-look="marketplace"][data-pw-scene-lock] .pw-header,
html[data-pw-look="marketplace"][data-pw-scene-lock] .pw-shop-header{
  background:var(--pw-primary)!important;
  color:#fff!important;
  border-bottom:none!important;
}
html[data-pw-look="marketplace"] .pw-wordmark,
html[data-pw-look="marketplace"][data-pw-edit-device] .pw-wordmark,
html[data-pw-look="marketplace"][data-pw-scene-lock] .pw-wordmark{
  color:#fff!important;
}
`.trim())
}

/** One engine sheet: theme tokens + look + chrome layout + footer fit. Color picker still drives `--pw-*`. */

export function buildPartnerShopLiveCssPack(theme?: PartnerWebsiteTheme | null): string {
  const resolved = resolvedLiveTheme(theme)
  const marketplace = resolved.look === PARTNER_WEBSITE_LOOK_MARKETPLACE
  const lookCss = marketplace ? buildMarketplaceLookCss() : buildShopLookCss()
  return [
    buildPartnerSiteShopThemeCss(resolved),
    PARTNER_SHOP_CHROME_LAYOUT_CSS,
    lookCss,
    PW_SHOP_FOOTER_FIT_CSS,
    marketplace ? marketplaceHeaderBeatsWideWhiteCss() : '',
  ]
    .filter((chunk) => String(chunk || '').trim())
    .join('\n')
}

export function stripPartnerShopEngineStyleTags(html: string): string {
  if (!html.trim()) return html
  ENGINE_STYLE_ID_RE.lastIndex = 0
  return html
    .replace(ENGINE_STYLE_ID_RE, '')
    .replace(new RegExp(`<link\\b[^>]*\\bid=["']${PARTNER_SHOP_LIVE_CSS_LINK_ID}["'][^>]*>`, 'gi'), '')
}

function insertInHead(html: string, snippet: string): string {
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${snippet}\n</head>`)
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${snippet}</head>`)
  return `${snippet}\n${html}`
}

/** Live storefront: stamp look + one stylesheet link. Sửa nhanh keeps inline CSS. */
export function injectPartnerShopLiveCssHref(
  html: string,
  input: { siteSlug: string; theme?: PartnerWebsiteTheme | null }
): string {
  const trimmed = html.trim()
  const slug = input.siteSlug.trim()
  if (!trimmed || !slug) return html
  const resolved = resolvedLiveTheme(input.theme, trimmed)
  let out = stampPartnerWebsiteLookInHtml(trimmed, resolved.look || 'shop')
  out = stripPartnerShopEngineStyleTags(out)
  const href = partnerShopLiveCssHref(slug, resolved)
  const link = `<link id="${PARTNER_SHOP_LIVE_CSS_LINK_ID}" rel="stylesheet" href="${href}"/>`
  if (resolved.look === PARTNER_WEBSITE_LOOK_MARKETPLACE && !/family=Nunito/i.test(out)) {
    const font = `<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link rel="stylesheet" href="${MARKETPLACE_GOOGLE_FONTS_HREF}"/>`
    out = insertInHead(out, `${font}\n${link}`)
  } else {
    out = insertInHead(out, link)
  }
  return upsertShopBrowserThemeColorInHtml(out, resolved)
}
