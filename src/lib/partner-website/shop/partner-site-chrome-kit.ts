/**
 * Kit chrome sẵn trong head / thanh đáy — ẩn hiện + thứ tự, không tọa độ.
 * Một engine mọi shop. Sửa nhanh = live vì nút in-flow flex.
 */
import type { WebLocale } from '@/lib/i18n/config'
import { PW_HIDDEN_ATTR } from '@/lib/partner-website/shop/stay-scroll-elements'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { PW_EL, pwElAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'
import {
  buildVisualEditorChromeWidgetHtml,
  type VisualEditorChromeWidgetKind,
} from '@/lib/partner-website/visual-editor/chrome-widgets'

export const PW_CHROME_KIT_ATTR = 'data-pw-chrome-kit'
export const PW_DOCK_SHOW_ATTR = 'data-pw-dock-show'
export const PW_DOCK_SLOT_ATTR = 'data-pw-dock-slot'
/** Lệch ngang cả cụm icon head — transform trên host, không đụng ô tìm. */
export const PW_KIT_X_ATTR = 'data-pw-kit-x'
/** Âm đủ để kéo icon sát ô tìm neo giữa (header ~1200, ô tìm 380). */
export const PW_KIT_X_MIN = -360
export const PW_KIT_X_MAX = 80

export function clampChromeKitShift(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return 0
  return Math.max(PW_KIT_X_MIN, Math.min(PW_KIT_X_MAX, n))
}

export type ChromeKitDockShow = 'shop' | 'pdp' | 'both'
export type ChromeKitDockSlot = 'icon' | 'cta'
export type ChromeKitHeadGroup = 'pc' | 'tablet' | 'mobile'

export type ChromeKitHeadItem = {
  kind: VisualEditorChromeWidgetKind
  defaultOn: Record<ChromeKitHeadGroup, boolean>
}

export type ChromeKitDockItem = {
  kind: VisualEditorChromeWidgetKind
  slot: ChromeKitDockSlot
  defaultShow: ChromeKitDockShow | 'off'
}

/** Nút nhóm phải (và Chat mua) — seed sẵn, phần lớn tắt. */
export const CHROME_KIT_HEAD_ACTION_ITEMS: ChromeKitHeadItem[] = [
  { kind: 'account', defaultOn: { pc: true, tablet: false, mobile: false } },
  { kind: 'recently-viewed', defaultOn: { pc: true, tablet: false, mobile: false } },
  { kind: 'cart', defaultOn: { pc: true, tablet: true, mobile: true } },
  { kind: 'chat', defaultOn: { pc: false, tablet: false, mobile: false } },
  { kind: 'notifications', defaultOn: { pc: false, tablet: false, mobile: false } },
  { kind: 'wishlist', defaultOn: { pc: false, tablet: false, mobile: false } },
  { kind: 'orders', defaultOn: { pc: false, tablet: false, mobile: false } },
  { kind: 'sale', defaultOn: { pc: false, tablet: false, mobile: false } },
  { kind: 'contact', defaultOn: { pc: false, tablet: false, mobile: false } },
]

/** Thanh đáy mobile+tablet: một nav, ẩn hiện theo trang. */
export const CHROME_KIT_DOCK_ITEMS: ChromeKitDockItem[] = [
  { kind: 'home', slot: 'icon', defaultShow: 'both' },
  { kind: 'products', slot: 'icon', defaultShow: 'shop' },
  { kind: 'cart', slot: 'icon', defaultShow: 'shop' },
  { kind: 'account', slot: 'icon', defaultShow: 'shop' },
  { kind: 'categories', slot: 'icon', defaultShow: 'off' },
  { kind: 'sale', slot: 'icon', defaultShow: 'off' },
  { kind: 'wishlist', slot: 'icon', defaultShow: 'off' },
  { kind: 'recently-viewed', slot: 'icon', defaultShow: 'off' },
  { kind: 'chat', slot: 'icon', defaultShow: 'off' },
  { kind: 'notifications', slot: 'icon', defaultShow: 'off' },
  { kind: 'orders', slot: 'icon', defaultShow: 'off' },
  { kind: 'contact', slot: 'icon', defaultShow: 'off' },
  { kind: 'try-on', slot: 'icon', defaultShow: 'pdp' },
  { kind: 'favorite-product', slot: 'icon', defaultShow: 'pdp' },
  { kind: 'add-cart', slot: 'cta', defaultShow: 'pdp' },
  { kind: 'buy-now', slot: 'cta', defaultShow: 'pdp' },
]

const HEAD_ACTION_KIND_SET = new Set(CHROME_KIT_HEAD_ACTION_ITEMS.map((item) => item.kind))
const DOCK_KIND_SET = new Set(CHROME_KIT_DOCK_ITEMS.map((item) => item.kind))

export function chromeKitHeadGroup(device?: VisualDeviceVariant | null): ChromeKitHeadGroup {
  if (device === 'tablet') return 'tablet'
  if (device === 'mobile') return 'mobile'
  return 'pc'
}

export function isChromeKitManagedKind(kind: string): boolean {
  return HEAD_ACTION_KIND_SET.has(kind as VisualEditorChromeWidgetKind) || DOCK_KIND_SET.has(kind as VisualEditorChromeWidgetKind)
}

export function isChromeKitPickerKind(kind: string): boolean {
  return isChromeKitManagedKind(kind) || kind === 'categories' || kind === 'search' || kind === 'search-image' || kind === 'login' || kind === 'favorites-link'
}

function slugOrShop(siteSlug?: string | null): string {
  return siteSlug?.trim() || 'shop'
}

function asKitTag(html: string, extras: string): string {
  return html
    .replace(/\sdata-pw-chrome-added=(["'])1\1/gi, ` ${PW_CHROME_KIT_ATTR}="1"`)
    .replace(/\sdata-pw-chrome-float=(["'])1\1/gi, '')
    .replace(/<(a|button)\b/i, (open) => `${open}${extras}`)
}

function hiddenAttr(on: boolean): string {
  return on ? '' : ` ${PW_HIDDEN_ATTR}="1"`
}

export function buildChromeKitHeadActionHtml(input: {
  locale: WebLocale
  siteSlug?: string | null
  device?: VisualDeviceVariant | null
  logoUrl?: string | null
  chatIconLogoUrl?: string | null
}): string {
  const group = chromeKitHeadGroup(input.device)
  const slug = slugOrShop(input.siteSlug)
  return CHROME_KIT_HEAD_ACTION_ITEMS.map((item) => {
    const raw = buildVisualEditorChromeWidgetHtml({
      kind: item.kind,
      siteSlug: slug,
      locale: input.locale,
      style: group === 'pc' ? 'icon-label-below' : 'icon',
      place: 'header',
      logoUrl: input.logoUrl,
      chatIconLogoUrl: input.chatIconLogoUrl,
    })
    if (!raw) return ''
    return asKitTag(raw, hiddenAttr(item.defaultOn[group]))
  })
    .filter(Boolean)
    .join('\n      ')
}

function dockShowAttr(show: ChromeKitDockShow | 'off'): string {
  if (show === 'off') return ` ${PW_DOCK_SHOW_ATTR}="shop" ${PW_HIDDEN_ATTR}="1"`
  return ` ${PW_DOCK_SHOW_ATTR}="${show}"`
}

function buildDockPdpFavoriteHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return `<button type="button" class="is-fav" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="favorite-product" ${pwElAttr(PW_EL.wishlist)} ${PW_DOCK_SLOT_ATTR}="icon" ${PW_DOCK_SHOW_ATTR}="pdp" data-pw-favorite data-pw-pdp-favorite="1" data-pw-like-base="0" aria-pressed="false">${pdpHeartSvg()}<span class="pw-pdp-like-copy"><span>${escapeText(t.pdpStickyLikeLabel)}</span><span class="pw-pdp-like-count" data-pw-like-count>0</span></span></button>`
}

function buildDockPdpTryOnHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return `<button type="button" class="is-try" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="try-on" ${PW_DOCK_SLOT_ATTR}="icon" ${PW_DOCK_SHOW_ATTR}="pdp" data-nanoai-try-on>${pdpTryOnSvg()}<span class="pw-pdp-sticky-copy"><span>${escapeText(t.pdpStickyTryOnL1)}</span>${t.pdpStickyTryOnL2 ? `<span>${escapeText(t.pdpStickyTryOnL2)}</span>` : ''}</span></button>`
}

function buildDockPdpCtaHtml(kind: 'add-cart' | 'buy-now', locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  if (kind === 'add-cart') {
    return `<button type="button" class="pw-shop-btn pw-shop-btn-cart" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="add-cart" ${pwElAttr(PW_EL.cardCart)} ${PW_DOCK_SLOT_ATTR}="cta" ${PW_DOCK_SHOW_ATTR}="pdp" data-pw-add-cart data-pw-pdp-add-cart="1">${escapeText(t.pdpAddToCartShort)}</button>`
  }
  return `<button type="button" class="pw-shop-btn pw-shop-btn-buy" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="buy-now" ${pwElAttr(PW_EL.buy)} ${PW_DOCK_SLOT_ATTR}="cta" ${PW_DOCK_SHOW_ATTR}="pdp" data-pw-buy data-pw-pdp-buy-now="1">${escapeText(t.pdpBuyNowShort)}</button>`
}

export function buildChromeKitDockHtml(input: {
  locale: WebLocale
  siteSlug?: string | null
  logoUrl?: string | null
  chatIconLogoUrl?: string | null
}): string {
  const slug = slugOrShop(input.siteSlug)
  return CHROME_KIT_DOCK_ITEMS.map((item) => {
    if (item.kind === 'try-on') return buildDockPdpTryOnHtml(input.locale)
    if (item.kind === 'favorite-product') return buildDockPdpFavoriteHtml(input.locale)
    if (item.kind === 'add-cart' || item.kind === 'buy-now') {
      return buildDockPdpCtaHtml(item.kind, input.locale)
    }
    const raw = buildVisualEditorChromeWidgetHtml({
      kind: item.kind,
      siteSlug: slug,
      locale: input.locale,
      style: 'icon-label-below',
      place: 'nav',
      logoUrl: input.logoUrl,
      chatIconLogoUrl: input.chatIconLogoUrl,
    })
    if (!raw) return ''
    return asKitTag(raw, `${dockShowAttr(item.defaultShow)} ${PW_DOCK_SLOT_ATTR}="${item.slot}"`)
  })
    .filter(Boolean)
    .join('\n    ')
}

export const PARTNER_SHOP_CHROME_KIT_CSS = `
.pw-header-actions[${PW_CHROME_KIT_ATTR}="actions"],.pw-shop-header-actions[${PW_CHROME_KIT_ATTR}="actions"]{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;margin-right:0!important;transform:translateX(var(--pw-kit-x, 0px))!important}
.pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"],.pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"]{flex-wrap:nowrap!important;align-items:stretch}
body:not([data-pw-page="product"]) .pw-bottom-nav [${PW_DOCK_SHOW_ATTR}="pdp"],body:not([data-pw-page="product"]) .pw-shop-bottom-nav [${PW_DOCK_SHOW_ATTR}="pdp"]{display:none!important}
body[data-pw-page="product"] .pw-bottom-nav [${PW_DOCK_SHOW_ATTR}="shop"],body[data-pw-page="product"] .pw-shop-bottom-nav [${PW_DOCK_SHOW_ATTR}="shop"]{display:none!important}
body[data-pw-page="product"] .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"],body[data-pw-page="product"] .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"]{
  justify-content:flex-start!important;align-items:stretch!important;gap:6px!important;min-height:48px!important;
  padding:2px 6px calc(2px + env(safe-area-inset-bottom,0px))!important;background:#f3f4f6!important;border-top:1px solid #e5e7eb!important
}
body[data-pw-page="product"] .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] [${PW_DOCK_SLOT_ATTR}="icon"]:not([${PW_HIDDEN_ATTR}="1"]),body[data-pw-page="product"] .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] [${PW_DOCK_SLOT_ATTR}="icon"]:not([${PW_HIDDEN_ATTR}="1"]){
  flex:0 0 44px!important;width:44px!important;gap:2px!important;padding:2px 0!important;font-size:10px!important;line-height:1.05!important;color:#4b5563!important;background:transparent!important
}
body[data-pw-page="product"] .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] [${PW_DOCK_SLOT_ATTR}="cta"]:not([${PW_HIDDEN_ATTR}="1"]),body[data-pw-page="product"] .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] [${PW_DOCK_SLOT_ATTR}="cta"]:not([${PW_HIDDEN_ATTR}="1"]){
  flex:1 1 0!important;min-height:40px;padding:0 8px!important;font-size:11px!important;font-weight:600!important;text-transform:uppercase;border-radius:6px!important;color:#fff!important
}
body[data-pw-page="product"] .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] [data-pw-chrome-btn="add-cart"],body[data-pw-page="product"] .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] [data-pw-chrome-btn="add-cart"]{background:var(--pw-cart)!important;color:#fff!important}
body[data-pw-page="product"] .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] [data-pw-chrome-btn="buy-now"],body[data-pw-page="product"] .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] [data-pw-chrome-btn="buy-now"]{background:var(--pw-buy)!important;color:#fff!important}
body[data-pw-page="product"] .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] ~ .pw-bottom-nav[data-pw-pdp-bottom],body[data-pw-page="product"] .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] ~ .pw-bottom-nav[data-pw-pdp-bottom],
body[data-pw-page="product"] .pw-bottom-nav[data-pw-pdp-bottom] ~ .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"]{display:none!important}
body:not([data-pw-page="product"]) .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"],body:not([data-pw-page="product"]) .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"]{
  justify-content:stretch!important;gap:0!important;min-height:56px!important;
  padding:4px 2px calc(4px + env(safe-area-inset-bottom,0px))!important;background:#fff!important;border-top:1px solid var(--pw-border,#e5e7eb)!important
}
body:not([data-pw-page="product"]) .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] > [${PW_CHROME_KIT_ATTR}="1"]:not([${PW_HIDDEN_ATTR}="1"]),body:not([data-pw-page="product"]) .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] > [${PW_CHROME_KIT_ATTR}="1"]:not([${PW_HIDDEN_ATTR}="1"]){
  flex:1 1 0!important;min-width:0!important;max-width:none!important;width:auto!important
}
.pw-header-actions [${PW_CHROME_KIT_ATTR}="1"].pw-chrome-label-below:not([${PW_HIDDEN_ATTR}="1"]),.pw-shop-header-actions [${PW_CHROME_KIT_ATTR}="1"].pw-chrome-label-below:not([${PW_HIDDEN_ATTR}="1"]),
.pw-header-actions [${PW_CHROME_KIT_ATTR}="1"][data-pw-chrome-style="icon-label-below"]:not([${PW_HIDDEN_ATTR}="1"]),.pw-shop-header-actions [${PW_CHROME_KIT_ATTR}="1"][data-pw-chrome-style="icon-label-below"]:not([${PW_HIDDEN_ATTR}="1"]){
  display:inline-flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;
  padding:2px 6px!important;border-radius:10px!important;min-width:52px!important;gap:2px!important;flex:0 0 auto!important
}
.pw-header-actions [${PW_CHROME_KIT_ATTR}="1"].pw-chrome-icon-only,.pw-shop-header-actions [${PW_CHROME_KIT_ATTR}="1"].pw-chrome-icon-only{
  flex:0 0 auto!important;padding:4px!important
}
[${PW_CHROME_KIT_ATTR}="1"]:not([data-pw-user-move]){position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;transform:none!important}
`.trim()

const HEADER_SEARCH_OPEN_RE =
  /<(div)(\s[^>]*class=["'][^"']*\b(?:pw-header-search|pw-shop-search-wrap)\b[^>]*)>/gi

/** Ô tìm in-flow trong head: bỏ kéo cũ / width khóa, để CSS căn giữa. */
function resetInflowHeaderSearchOpenTag(tag: string, attrs: string): string {
  if (/\bdata-pw-placement=/.test(attrs)) return `<${tag}${attrs}>`
  if (/\bdata-pw-stay-scroll=/.test(attrs)) return `<${tag}${attrs}>`
  if (/\bdata-pw-box-x=/.test(attrs) || /\bdata-pw-fixed-x=/.test(attrs)) return `<${tag}${attrs}>`
  const keepWidth = /\bdata-pw-search-width-user=["']1["']/.test(attrs)
  let next = attrs.replace(/\sdata-pw-user-move=(["'])[^"']*\1/gi, '')
  if (!keepWidth) {
    next = next.replace(/\sdata-pw-search-width=(["'])[^"']*\1/gi, '')
  }
  next = next.replace(/\sstyle=(["'])([\s\S]*?)\1/i, (_s, q: string, css: string) => {
    const cleaned = String(css)
      .replace(
        /(?:^|;)\s*(?:width|flex|max-width|min-width|margin(?:-left|-right)?|left|top|right|bottom|transform|position|inset)\s*:[^;]*/gi,
        keepWidth
          ? (chunk: string) =>
              /(?:width|flex|max-width|min-width)\s*:/i.test(chunk) ? chunk : ''
          : ''
      )
      .replace(/^;+|;+$/g, '')
      .trim()
    return cleaned ? ` style=${q}${cleaned}${q}` : ''
  })
  return `<${tag}${next}>`
}

const HEADER_ACTIONS_RE =
  /<(div)([^>]*class=["'][^"']*\b(?:pw-header-actions|pw-shop-header-actions)\b[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/i
const BOTTOM_NAV_RE =
  /<(nav)([^>]*class=["'][^"']*\b(?:pw-bottom-nav|pw-shop-bottom-nav)\b[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/i
const PDP_BOTTOM_NAV_RE =
  /<(nav)[^>]*(?:data-pw-pdp-bottom=["']1["']|class=["'][^"']*\bpw-pdp-sticky\b)[^>]*>[\s\S]*?<\/\1>/i

function htmlHasChromeKind(html: string, kind: string): boolean {
  const re = new RegExp(`data-pw-chrome-btn=["']${kind}["']`, 'i')
  return re.test(html)
}

function stampExistingKitAttrs(inner: string, bar: 'head' | 'dock'): string {
  return inner.replace(/<(a|button)(\s[^>]*?)>/gi, (full, tag: string, attrs: string) => {
    const kind = attrs.match(/\bdata-pw-chrome-btn=["']([^"']+)["']/i)?.[1] || ''
    if (!kind) return full
    if (bar === 'head' && !HEAD_ACTION_KIND_SET.has(kind as VisualEditorChromeWidgetKind)) return full
    if (bar === 'dock' && !DOCK_KIND_SET.has(kind as VisualEditorChromeWidgetKind)) return full
    let next = attrs
      .replace(/\sdata-pw-chrome-added=(["'])[^"']*\1/gi, '')
      .replace(/\sdata-pw-chrome-float=(["'])[^"']*\1/gi, '')
      .replace(/\sdata-pw-user-move=(["'])[^"']*\1/gi, '')
      .replace(/\sdata-pw-placement=(["'])[^"']*\1/gi, '')
      .replace(/\sdata-pw-box-[xywh]=(["'])[^"']*\1/gi, '')
      .replace(/\sdata-pw-fixed-(?:x|y|w|h)=(["'])[^"']*\1/gi, '')
    if (!new RegExp(`\\b${PW_CHROME_KIT_ATTR}=`, 'i').test(next)) next += ` ${PW_CHROME_KIT_ATTR}="1"`
    if (bar === 'dock') {
      const spec = CHROME_KIT_DOCK_ITEMS.find((item) => item.kind === kind)
      if (spec && !new RegExp(`\\b${PW_DOCK_SHOW_ATTR}=`, 'i').test(next)) {
        next += spec.defaultShow === 'off' ? ` ${PW_DOCK_SHOW_ATTR}="shop"` : ` ${PW_DOCK_SHOW_ATTR}="${spec.defaultShow}"`
      }
      if (spec && !new RegExp(`\\b${PW_DOCK_SLOT_ATTR}=`, 'i').test(next)) {
        next += ` ${PW_DOCK_SLOT_ATTR}="${spec.slot}"`
      }
    }
    next = next.replace(/\sstyle=(["'])([\s\S]*?)\1/i, (_s, q: string, css: string) => {
      const cleaned = String(css)
        .replace(/(?:^|;)\s*(?:position|left|top|right|bottom|transform)\s*:[^;]*/gi, '')
        .replace(/^;+|;+$/g, '')
        .trim()
      return cleaned ? ` style=${q}${cleaned}${q}` : ''
    })
    return `<${tag}${next}>`
  })
}

function withHostKitAttr(openAttrs: string, value: 'actions' | 'dock'): string {
  if (new RegExp(`\\b${PW_CHROME_KIT_ATTR}=`, 'i').test(openAttrs)) {
    return openAttrs.replace(new RegExp(`\\s${PW_CHROME_KIT_ATTR}=(["'])[^"']*\\1`, 'i'), ` ${PW_CHROME_KIT_ATTR}="${value}"`)
  }
  return `${openAttrs} ${PW_CHROME_KIT_ATTR}="${value}"`
}

/** Gắn `--pw-kit-x` từ `data-pw-kit-x` để live đọc CSS var, không cần JS. */
function withHostKitShiftStyle(openAttrs: string): string {
  const fromAttr = openAttrs.match(new RegExp(`\\b${PW_KIT_X_ATTR}=(["'])([^"']*)\\1`, 'i'))?.[2]
  const fromCss = openAttrs.match(/--pw-kit-x\s*:\s*(-?\d+(?:\.\d+)?)px/i)?.[1]
  const n = clampChromeKitShift(fromAttr ?? fromCss)
  const styleMatch = openAttrs.match(/\sstyle=(["'])([\s\S]*?)\1/i)
  const quote = styleMatch?.[1] || '"'
  let css = String(styleMatch?.[2] || '')
    .replace(/(?:^|;)\s*--pw-kit-x\s*:[^;]*/gi, '')
    .replace(/^;+|;+$/g, '')
    .trim()
  let next = openAttrs.replace(new RegExp(`\\s${PW_KIT_X_ATTR}=(["'])[^"']*\\1`, 'i'), '')
  if (n === 0) {
    if (styleMatch) {
      next = css
        ? next.replace(/\sstyle=(["'])([\s\S]*?)\1/i, ` style=${quote}${css}${quote}`)
        : next.replace(/\sstyle=(["'])([\s\S]*?)\1/i, '')
    }
    return next
  }
  next += ` ${PW_KIT_X_ATTR}="${n}"`
  const nextCss = css ? `${css};--pw-kit-x:${n}px` : `--pw-kit-x:${n}px`
  if (styleMatch) return next.replace(/\sstyle=(["'])([\s\S]*?)\1/i, ` style=${quote}${nextCss}${quote}`)
  return `${next} style=${quote}${nextCss}${quote}`
}

/**
 * HTML cũ: gắn kit vào nút sẵn, thêm nút thiếu (ẩn theo mặc định), gỡ tọa độ.
 * Không ẩn nút merchant đang hiện.
 */
export function ensurePartnerSiteChromeKitInHtml(
  html: string,
  input: {
    locale?: WebLocale | null
    siteSlug?: string | null
    device?: VisualDeviceVariant | null
    logoUrl?: string | null
    chatIconLogoUrl?: string | null
  }
): string {
  if (!html.trim()) return html
  const locale = input.locale ?? 'vi'
  let out = html.replace(HEADER_SEARCH_OPEN_RE, (_full, tag: string, attrs: string) =>
    resetInflowHeaderSearchOpenTag(tag, attrs)
  )

  out = out.replace(HEADER_ACTIONS_RE, (_full, _tag: string, attrs: string, inner: string) => {
    let nextInner = stampExistingKitAttrs(inner, 'head')
    const missing = CHROME_KIT_HEAD_ACTION_ITEMS.filter((item) => !htmlHasChromeKind(nextInner, item.kind))
    if (missing.length) {
      const extra = buildChromeKitHeadActionHtml({
        locale,
        siteSlug: input.siteSlug,
        device: input.device,
        logoUrl: input.logoUrl,
        chatIconLogoUrl: input.chatIconLogoUrl,
      })
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => {
          const kind = line.match(/data-pw-chrome-btn=["']([^"']+)["']/)?.[1]
          return kind && missing.some((item) => item.kind === kind)
        })
        .join('\n      ')
      if (extra) nextInner = `${nextInner.trim()}\n      ${extra}\n    `
    }
    return `<div${withHostKitShiftStyle(withHostKitAttr(attrs, 'actions'))}>${nextInner}</div>`
  })

  const kitDockAlready = new RegExp(`${PW_CHROME_KIT_ATTR}=["']dock["']`, 'i').test(out)
  out = out.replace(BOTTOM_NAV_RE, (full, _tag: string, attrs: string, inner: string) => {
    if (/data-pw-pdp-bottom=["']1["']/i.test(attrs) && kitDockAlready) return full
    if (/data-pw-pdp-bottom=["']1["']/i.test(attrs)) return full
    let nextInner = stampExistingKitAttrs(inner, 'dock')
    const missing = CHROME_KIT_DOCK_ITEMS.filter((item) => !htmlHasChromeKind(nextInner, item.kind))
    if (missing.length) {
      const extra = buildChromeKitDockHtml({
        locale,
        siteSlug: input.siteSlug,
        logoUrl: input.logoUrl,
        chatIconLogoUrl: input.chatIconLogoUrl,
      })
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => {
          const kind = line.match(/data-pw-chrome-btn=["']([^"']+)["']/)?.[1]
          return kind && missing.some((item) => item.kind === kind)
        })
        .join('\n    ')
      if (extra) nextInner = `${nextInner.trim()}\n    ${extra}\n  `
    }
    return `<nav${withHostKitAttr(attrs, 'dock')}>${nextInner}</nav>`
  })

  const hasKitDock = new RegExp(`${PW_CHROME_KIT_ATTR}=["']dock["']`, 'i').test(out)
  if (hasKitDock) {
    out = out.replace(PDP_BOTTOM_NAV_RE, (block) => {
      if (/<div\b/i.test(block) && !/data-pw-pdp-bottom=/i.test(block)) return block
      if (/data-pw-pdp-bottom=["']1["']/i.test(block)) return ''
      return block
    })
  } else if (/data-pw-pdp-bottom=["']1["']/i.test(out)) {
    const dock = `<nav class="pw-bottom-nav pw-shop-bottom-nav" data-pw-region="nav" ${PW_CHROME_KIT_ATTR}="dock">\n    ${buildChromeKitDockHtml({
      locale,
      siteSlug: input.siteSlug,
      logoUrl: input.logoUrl,
      chatIconLogoUrl: input.chatIconLogoUrl,
    })}\n  </nav>`
    out = out.replace(PDP_BOTTOM_NAV_RE, (block) => {
      if (/<div\b/i.test(block) && !/data-pw-pdp-bottom=/i.test(block)) return block
      return dock
    })
  }

  return out
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pdpTryOnSvg(): string {
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>`
}

function pdpHeartSvg(): string {
  return `<svg class="pw-pdp-like-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`
}
