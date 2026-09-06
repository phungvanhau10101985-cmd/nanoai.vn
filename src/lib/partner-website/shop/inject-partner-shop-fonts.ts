import {
  FASHION_SHOP_FONT_DISPLAY,
  FASHION_SHOP_FONT_UI,
  FASHION_SHOP_GOOGLE_FONTS_HREF,
} from '@/lib/partner-website/shop/fashion-shop-design'

export const PARTNER_SHOP_FONT_STYLE_ID = 'pw-shop-fonts'
export const PARTNER_SHOP_FONT_LINK_ATTR = 'data-pw-shop-fonts'

/** Canonical fashion shop typography — same stack in Sửa nhanh, Xem, and custom domain. */
export function buildPartnerShopFontCss(): string {
  return `:root{
--pw-font-display:${FASHION_SHOP_FONT_DISPLAY};
--pw-font-ui:${FASHION_SHOP_FONT_UI};
}
html,body{font-family:var(--pw-font-ui);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
.pw-topbar,.pw-shop-topbar,.pw-topbar a,.pw-topbar button,.pw-shop-topbar a,.pw-shop-topbar button,
.pw-header-actions,.pw-shop-header-actions,.pw-bottom-nav,.pw-shop-bottom-nav,.pw-nav-main,.pw-shop-nav-row,
.pw-cat-btn,.pw-shop-cat-btn,.pw-search-form,.pw-shop-search-form,input,button,select,textarea{
font-family:var(--pw-font-ui)
}
.pw-wordmark,.pw-brand,.pw-hero h1,.pw-hero h2,.pw-hero-copy h1,.pw-hero-copy h2,
[data-pw-el="title"],[data-pw-el="section-title"],.pw-section-title{
font-family:var(--pw-font-display),var(--pw-font-ui),serif
}`
}

export function buildPartnerShopFontHeadLinks(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" ${PARTNER_SHOP_FONT_LINK_ATTR}="1">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" ${PARTNER_SHOP_FONT_LINK_ATTR}="1">
<link rel="stylesheet" href="${FASHION_SHOP_GOOGLE_FONTS_HREF}" ${PARTNER_SHOP_FONT_LINK_ATTR}="1">`
}

export function htmlHasPartnerShopFontPack(html: string): boolean {
  return (
    html.includes(`id="${PARTNER_SHOP_FONT_STYLE_ID}"`) ||
    new RegExp(`\\b${PARTNER_SHOP_FONT_LINK_ATTR}=["']1["']`, 'i').test(html)
  )
}

function headHasBeVietnamGoogleFont(html: string): boolean {
  return /fonts\.googleapis\.com/i.test(html) && /Be\+Vietnam\+Pro|Be%20Vietnam%20Pro/i.test(html)
}

/** Inject Google Fonts + `--pw-font-*` tokens into saved visual HTML. */
export function injectPartnerShopFontsIntoHtml(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return html

  const styleTag = `<style id="${PARTNER_SHOP_FONT_STYLE_ID}">${buildPartnerShopFontCss()}</style>`
  let out = trimmed.replace(
    new RegExp(`<style id="${PARTNER_SHOP_FONT_STYLE_ID}">[\\s\\S]*?<\\/style>`, 'gi'),
    styleTag
  )
  if (!out.includes(`id="${PARTNER_SHOP_FONT_STYLE_ID}"`)) {
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${styleTag}\n</head>`)
    else if (/<html[^>]*>/i.test(out)) out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${styleTag}</head>`)
    else out = `${styleTag}\n${out}`
  }

  if (!headHasBeVietnamGoogleFont(out)) {
    const links = buildPartnerShopFontHeadLinks()
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${links}\n</head>`)
    else if (/<html[^>]*>/i.test(out)) out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${links}</head>`)
    else out = `${links}\n${out}`
  }

  return out
}

/** Custom domain renders body inline — `<head>` link tags are dropped unless hoisted in React. */
export function extractVisualHtmlBodyMarkup(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''
  const body = trimmed.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]
  return body?.trim() ? body : trimmed
}

/** `data-pw-page` lives on `<html>` / `<body>` — lost when only inner body is inlined. */
export function extractVisualHtmlPageKind(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''
  const fromHtml = trimmed.match(/<html\b[^>]*\bdata-pw-page=["']([^"']+)["']/i)?.[1]
  if (fromHtml?.trim()) return fromHtml.trim()
  const fromBody = trimmed.match(/<body\b[^>]*\bdata-pw-page=["']([^"']+)["']/i)?.[1]
  return fromBody?.trim() || ''
}

/** `data-pw-look` lives on `<html>` — lost when live inlines body into the Next.js page. */
export function extractVisualHtmlLook(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''
  const fromHtml = trimmed.match(/<html\b[^>]*\bdata-pw-look=["']([^"']+)["']/i)?.[1]
  if (fromHtml?.trim()) return fromHtml.trim()
  const fromBody = trimmed.match(/<body\b[^>]*\bdata-pw-look=["']([^"']+)["']/i)?.[1]
  return fromBody?.trim() || ''
}
