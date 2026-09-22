import { hashShopCachePayload } from '@/lib/cache/partner-shop-cache'
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
  htmlHasMarketplaceLook,
  isMarketplaceLook,
  MARKETPLACE_GOOGLE_FONTS_HREF,
  PARTNER_MARKETPLACE_LOOK_STYLE_ID,
  PARTNER_WEBSITE_LOOK_MARKETPLACE,
  resolvePartnerWebsiteLook,
  stampPartnerWebsiteLookInHtml,
} from '@/lib/partner-website/shop/marketplace-shop-look-css'
import { buildShopLookCss, PARTNER_SHOP_LOOK_STYLE_ID } from '@/lib/partner-website/shop/shop-look-css'
import {
  PW_SHOP_FOOTER_FIT_CSS,
  PW_SHOP_FOOTER_FIT_STYLE_ID,
} from '@/lib/partner-website/shop/partner-site-footer-fit-css'
import {
  DEFAULT_PARTNER_WEBSITE_THEME,
  type PartnerWebsiteTheme,
} from '@/lib/partner-website/template/partner-website-template-types'
import { upsertShopBrowserThemeColorInHtml } from '@/lib/partner-website/template/partner-website-theme-tokens'

/** Bump when the live CSS pack contents change so HTML cache + `?v=` cannot reuse a stale sheet. */
export const PARTNER_SHOP_LIVE_CSS_PACK_VERSION = '1'
export const PARTNER_SHOP_LIVE_CSS_LINK_ID = 'pw-shop-live-css'
export const PARTNER_SHOP_LIVE_HTML_CACHE_EXTRA = 'css-href-1'

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

function resolvedLiveTheme(
  theme?: PartnerWebsiteTheme | null,
  html?: string
): PartnerWebsiteTheme {
  const look = resolvePartnerWebsiteLook(theme, html)
  const marketplace = look === PARTNER_WEBSITE_LOOK_MARKETPLACE || isMarketplaceLook(theme) || htmlHasMarketplaceLook(html || '')
  return marketplace && !isMarketplaceLook(theme)
    ? { ...(theme || DEFAULT_PARTNER_WEBSITE_THEME), look: PARTNER_WEBSITE_LOOK_MARKETPLACE }
    : { ...(theme || DEFAULT_PARTNER_WEBSITE_THEME), look }
}

export function partnerShopLiveCssVersion(theme?: PartnerWebsiteTheme | null): string {
  const resolved = resolvedLiveTheme(theme)
  return hashShopCachePayload({
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

export function partnerShopLiveCssHref(siteSlug: string, theme?: PartnerWebsiteTheme | null): string {
  const slug = siteSlug.trim()
  const v = partnerShopLiveCssVersion(theme)
  return `/api/site/${encodeURIComponent(slug)}/shop-theme.css?v=${v}`
}

/** One engine sheet: theme tokens + look + chrome layout + footer fit. Color picker still drives `--pw-*`. */
export function buildPartnerShopLiveCssPack(theme?: PartnerWebsiteTheme | null): string {
  const resolved = resolvedLiveTheme(theme)
  const lookCss =
    resolved.look === PARTNER_WEBSITE_LOOK_MARKETPLACE ? buildMarketplaceLookCss() : buildShopLookCss()
  return [buildPartnerSiteShopThemeCss(resolved), PARTNER_SHOP_CHROME_LAYOUT_CSS, lookCss, PW_SHOP_FOOTER_FIT_CSS]
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
