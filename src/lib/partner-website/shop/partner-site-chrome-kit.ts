/**
 * Kit chrome sẵn: head / thanh đáy / thanh nổi — ẩn hiện + thứ tự, không tọa độ.
 * Nút Thêm giữa trang (Cửa hàng / Ví quà…) — kéo tọa độ, luôn lớp nổi, mỗi máy một file.
 * Mỗi máy một bản (Desktop ≠ Laptop ≠ Tablet ≠ Mobile).
 */
import { WEB_LOCALES, type WebLocale } from '@/lib/i18n/config'
import { PW_HIDDEN_ATTR } from '@/lib/partner-website/shop/stay-scroll-elements'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteHomePath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  chromeDockIconSizeForDevice,
  chromeFloatRhythmForDevice,
  chromeHeadIconSizeForDevice,
  chromeHeadKitGapForDevice,
  PW_DOCK_BAR_MIN_H,
  PW_HEAD_KIT_GAP,
} from '@/lib/partner-website/shop/chrome-rhythm'
import {
  clampChromeFloatSize,
  PW_CHROME_FLOAT_KINDS,
  PW_FLOAT_GAP_ATTR,
  PW_FLOAT_RIGHT_ATTR,
  PW_FLOAT_SIZE_ATTR,
  PW_FLOAT_SIZE_DEFAULT,
  PW_FLOAT_STACK_BOTTOM_ATTR,
  type PwChromeFloatKind,
} from '@/lib/partner-website/shop/chrome-float-widgets'
import { PW_EL, pwElAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'
import {
  buildVisualEditorChromeWidgetHtml,
  isVisualEditorChromeWidgetKind,
  VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS,
  type VisualEditorChromeWidgetKind,
} from '@/lib/partner-website/visual-editor/chrome-widgets'
import { PW_SCENE_MAX_INDEX, pwSceneZ } from '@/lib/partner-website/visual-editor/pw-scene'

export const PW_CHROME_KIT_ATTR = 'data-pw-chrome-kit'
export const PW_DOCK_SHOW_ATTR = 'data-pw-dock-show'
export const PW_DOCK_SLOT_ATTR = 'data-pw-dock-slot'
/** Nút Thêm giỏ / Mua trên thanh đáy PDP — cố định, không sửa trên Sửa nhanh. */
export const PW_KIT_LOCK_ATTR = 'data-pw-kit-lock'
export const PW_PDP_HOME_ATTR = 'data-pw-pdp-home'
/** Lệch ngang cả cụm icon head — transform trên host, không đụng ô tìm. */
export const PW_KIT_X_ATTR = 'data-pw-kit-x'
/** Âm đủ để kéo icon sát ô tìm neo giữa (header ~1200, ô tìm 380). */
export const PW_KIT_X_MIN = -360
export const PW_KIT_X_MAX = 80
/** Khoảng cách giữa các icon cụm phải — flex gap trên host, không kéo từng nút. */
export const PW_KIT_GAP_ATTR = 'data-pw-kit-gap'
export const PW_KIT_GAP_MIN = 0
export const PW_KIT_GAP_MAX = 48
/** Desktop seed. Laptop 6 / tablet 6 / mobile 4 — `chromeHeadKitGapForDevice`. */
export const PW_KIT_GAP_DEFAULT = PW_HEAD_KIT_GAP.desktop
export const PW_KIT_GAP_DEFAULT_COMPACT = PW_HEAD_KIT_GAP.mobile

export function clampChromeKitShift(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return 0
  return Math.max(PW_KIT_X_MIN, Math.min(PW_KIT_X_MAX, n))
}

export function clampChromeKitGap(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return PW_KIT_GAP_DEFAULT
  return Math.max(PW_KIT_GAP_MIN, Math.min(PW_KIT_GAP_MAX, n))
}

export type ChromeKitDockShow = 'shop' | 'pdp' | 'both'
export type ChromeKitDockSlot = 'icon' | 'cta'
export type ChromeKitHeadGroup = 'desktop' | 'laptop' | 'tablet' | 'mobile'

export type ChromeKitHeadItem = {
  kind: VisualEditorChromeWidgetKind
  defaultOn: Record<ChromeKitHeadGroup, boolean>
}

export type ChromeKitFloatItem = {
  kind: PwChromeFloatKind
  defaultOn: boolean
}

export type ChromeKitDockItem = {
  kind: VisualEditorChromeWidgetKind
  slot: ChromeKitDockSlot
  defaultShow: ChromeKitDockShow | 'off'
}

/** Nút nhóm phải (và Chat mua) — seed sẵn, phần lớn tắt. */
export const CHROME_KIT_HEAD_ACTION_ITEMS: ChromeKitHeadItem[] = [
  { kind: 'account', defaultOn: { desktop: true, laptop: true, tablet: false, mobile: false } },
  { kind: 'recently-viewed', defaultOn: { desktop: true, laptop: true, tablet: false, mobile: false } },
  { kind: 'cart', defaultOn: { desktop: true, laptop: true, tablet: true, mobile: true } },
  { kind: 'chat', defaultOn: { desktop: false, laptop: false, tablet: false, mobile: false } },
  { kind: 'notifications', defaultOn: { desktop: false, laptop: false, tablet: false, mobile: false } },
  { kind: 'wishlist', defaultOn: { desktop: false, laptop: false, tablet: false, mobile: false } },
  { kind: 'orders', defaultOn: { desktop: false, laptop: false, tablet: false, mobile: false } },
  { kind: 'sale', defaultOn: { desktop: false, laptop: false, tablet: false, mobile: false } },
  { kind: 'contact', defaultOn: { desktop: false, laptop: false, tablet: false, mobile: false } },
]

export function isPdpDockCtaLocked(kind: string): boolean {
  return kind === 'add-cart' || kind === 'buy-now'
}

/** Mặt thanh đáy 188 trên trang chi tiết — không hiện trong panel trang chủ. */
export function isPdpDockFaceKind(kind: string): boolean {
  return kind === 'try-on' || kind === 'favorite-product' || isPdpDockCtaLocked(kind)
}

/** Icon trái trên PDP — mặc định 3 ô; có thể đổi sang phần tử dock khác. */
export const PW_PDP_NAV_MAX = 3
export const PW_PDP_NAV_ATTR = 'data-pw-pdp-nav'
export const CHROME_KIT_PDP_NAV_DEFAULT_KINDS = ['home', 'try-on', 'favorite-product'] as const

/** Thanh đáy — seed giống nhau, ẩn hiện độc lập từng máy (chỉ hiện Mobile/Tablet). */
export const CHROME_KIT_DOCK_ITEMS: ChromeKitDockItem[] = [
  { kind: 'home', slot: 'icon', defaultShow: 'shop' },
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

/** Thanh nổi mọi máy — Chat mua / Zalo / Facebook / Top, chỉ ẩn hiện. */
export const CHROME_KIT_FLOAT_ITEMS: ChromeKitFloatItem[] = PW_CHROME_FLOAT_KINDS.map((kind) => ({
  kind,
  defaultOn: false,
}))

const HEAD_ACTION_KIND_SET = new Set(CHROME_KIT_HEAD_ACTION_ITEMS.map((item) => item.kind))
const DOCK_KIND_SET = new Set(CHROME_KIT_DOCK_ITEMS.map((item) => item.kind))
const FLOAT_KIND_SET = new Set(CHROME_KIT_FLOAT_ITEMS.map((item) => item.kind))

export function isPdpDockNavKind(kind: string): boolean {
  if (isPdpDockCtaLocked(kind)) return false
  return DOCK_KIND_SET.has(kind as VisualEditorChromeWidgetKind)
}

export function chromeKitHeadGroup(device?: VisualDeviceVariant | null): ChromeKitHeadGroup {
  if (device === 'laptop' || device === 'tablet' || device === 'mobile') return device
  return 'desktop'
}

export function chromeKitGapDefaultForDevice(device?: VisualDeviceVariant | null): number {
  return chromeHeadKitGapForDevice(device)
}

/** Attr host cụm icon phải — seed / reset ghi gap theo máy. */
export function chromeKitHeadActionsHostAttrs(device?: VisualDeviceVariant | null): string {
  const gap = chromeKitGapDefaultForDevice(device)
  return `${PW_CHROME_KIT_ATTR}="actions" ${PW_KIT_GAP_ATTR}="${gap}" style="--pw-kit-gap:${gap}px"`
}

function chromeKitHeadStyle(group: ChromeKitHeadGroup): 'icon-label-below' | 'icon' {
  return group === 'desktop' || group === 'laptop' ? 'icon-label-below' : 'icon'
}

export function isChromeKitManagedKind(kind: string): boolean {
  return (
    HEAD_ACTION_KIND_SET.has(kind as VisualEditorChromeWidgetKind) ||
    DOCK_KIND_SET.has(kind as VisualEditorChromeWidgetKind) ||
    FLOAT_KIND_SET.has(kind as PwChromeFloatKind)
  )
}

export function isChromeKitPickerKind(kind: string): boolean {
  return isChromeKitManagedKind(kind) || kind === 'categories' || kind === 'search' || kind === 'search-image' || kind === 'login' || kind === 'favorites-link'
}

/** Nút Thêm ở giữa (Cửa hàng / Ví quà…) — kéo tọa độ, luôn lớp nổi. */
export const PW_MID_CANVAS_TOP_SCENE = PW_SCENE_MAX_INDEX

export function isMidCanvasFlowChromeKind(kind: string): boolean {
  return isVisualEditorChromeWidgetKind(kind) && !isChromeKitPickerKind(kind)
}

export function listMidCanvasFlowChromeKinds(): VisualEditorChromeWidgetKind[] {
  return VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS.filter((kind) => !isChromeKitPickerKind(kind))
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

function asFloatKitTag(html: string, extras: string): string {
  let next = html
    .replace(/\sdata-pw-chrome-added=(["'])1\1/gi, ` ${PW_CHROME_KIT_ATTR}="1"`)
    .replace(/<(a|button)\b/i, (open) => `${open}${extras}`)
  if (!/\bdata-pw-chrome-float=/i.test(next)) {
    next = next.replace(/<(a|button)\b/i, (open) => `${open} data-pw-chrome-float="1"`)
  }
  if (!new RegExp(`\\b${PW_CHROME_KIT_ATTR}=`, 'i').test(next)) {
    next = next.replace(/<(a|button)\b/i, (open) => `${open} ${PW_CHROME_KIT_ATTR}="1"`)
  }
  return next
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
  const iconSize = chromeHeadIconSizeForDevice(input.device)
  return CHROME_KIT_HEAD_ACTION_ITEMS.map((item) => {
    const raw = buildVisualEditorChromeWidgetHtml({
      kind: item.kind,
      siteSlug: slug,
      locale: input.locale,
      style: chromeKitHeadStyle(group),
      place: 'header',
      logoUrl: input.logoUrl,
      chatIconLogoUrl: input.chatIconLogoUrl,
      iconSize,
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

function dockPdpTwoLine(line1: string, line2?: string): string {
  const a = escapeText(line1)
  const b = (line2 || '').trim()
  if (!b) return `<span class="pw-pdp-sticky-copy"><span>${a}</span></span>`
  return `<span class="pw-pdp-sticky-copy"><span>${a}</span><span>${escapeText(b)}</span></span>`
}

export function buildDockPdpHomeHtml(locale: WebLocale, siteSlug?: string | null): string {
  const t = getPartnerSiteShopCopy(locale)
  const href = partnerSiteHomePath(slugOrShop(siteSlug))
  return `<a href="${href}" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="home" ${pwElAttr(PW_EL.navLink)} ${PW_DOCK_SLOT_ATTR}="icon" ${PW_DOCK_SHOW_ATTR}="pdp" ${PW_PDP_HOME_ATTR}="1" ${PW_PDP_NAV_ATTR}="1" aria-label="${escapeText(t.pdpStickyHome)}">${pdpHomeSvg()}${dockPdpTwoLine(t.pdpStickyHomeL1, t.pdpStickyHomeL2)}</a>`
}

export function buildDockPdpFavoriteHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return `<button type="button" class="is-fav" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="favorite-product" ${pwElAttr(PW_EL.wishlist)} ${PW_DOCK_SLOT_ATTR}="icon" ${PW_DOCK_SHOW_ATTR}="pdp" ${PW_PDP_NAV_ATTR}="1" data-pw-favorite data-pw-pdp-favorite="1" data-pw-like-base="0" aria-pressed="false">${pdpHeartSvg()}<span class="pw-pdp-like-copy"><span>${escapeText(t.pdpStickyLikeLabel)}</span><span class="pw-pdp-like-count" data-pw-like-count>0</span></span></button>`
}

export function buildDockPdpTryOnHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return `<button type="button" class="is-try" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="try-on" ${PW_DOCK_SLOT_ATTR}="icon" ${PW_DOCK_SHOW_ATTR}="pdp" ${PW_PDP_NAV_ATTR}="1" data-nanoai-try-on>${pdpTryOnSvg()}${dockPdpTwoLine(t.pdpStickyTryOnL1, t.pdpStickyTryOnL2)}</button>`
}

function buildDockPdpCtaHtml(kind: 'add-cart' | 'buy-now', locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  if (kind === 'add-cart') {
    return `<button type="button" class="pw-shop-btn pw-shop-btn-cart" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="add-cart" ${pwElAttr(PW_EL.cardCart)} ${PW_DOCK_SLOT_ATTR}="cta" ${PW_DOCK_SHOW_ATTR}="pdp" ${PW_KIT_LOCK_ATTR}="cta" data-pw-add-cart data-pw-pdp-add-cart="1">${escapeText(t.pdpAddToCartShort)}</button>`
  }
  return `<button type="button" class="pw-shop-btn pw-shop-btn-buy" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="buy-now" ${pwElAttr(PW_EL.buy)} ${PW_DOCK_SLOT_ATTR}="cta" ${PW_DOCK_SHOW_ATTR}="pdp" ${PW_KIT_LOCK_ATTR}="cta" data-pw-buy data-pw-pdp-buy-now="1">${escapeText(t.pdpBuyNowShort)}</button>`
}

function buildDockPdpExtraIconHtml(
  kind: VisualEditorChromeWidgetKind,
  input: { locale: WebLocale; siteSlug?: string | null; logoUrl?: string | null; chatIconLogoUrl?: string | null }
): string {
  if (kind === 'home') return buildDockPdpHomeHtml(input.locale, input.siteSlug)
  if (kind === 'try-on') return buildDockPdpTryOnHtml(input.locale)
  if (kind === 'favorite-product') return buildDockPdpFavoriteHtml(input.locale)
  const raw = buildVisualEditorChromeWidgetHtml({
    kind,
    siteSlug: slugOrShop(input.siteSlug),
    locale: input.locale,
    style: 'icon-label-below',
    place: 'nav',
    logoUrl: input.logoUrl,
    chatIconLogoUrl: input.chatIconLogoUrl,
  })
  if (!raw) return ''
  return asKitTag(
    raw,
    ` ${PW_DOCK_SHOW_ATTR}="pdp" ${PW_HIDDEN_ATTR}="1" ${PW_DOCK_SLOT_ATTR}="icon" ${PW_PDP_NAV_ATTR}="1"`
  )
}

export function pdpDockDefaultIconHtmlByLocale(siteSlug?: string | null): Record<
  WebLocale,
  Record<(typeof CHROME_KIT_PDP_NAV_DEFAULT_KINDS)[number], string>
> {
  return Object.fromEntries(
    WEB_LOCALES.map((locale) => [
      locale,
      {
        home: buildDockPdpHomeHtml(locale, siteSlug),
        'try-on': buildDockPdpTryOnHtml(locale),
        'favorite-product': buildDockPdpFavoriteHtml(locale),
      },
    ])
  ) as Record<WebLocale, Record<(typeof CHROME_KIT_PDP_NAV_DEFAULT_KINDS)[number], string>>
}

function buildDockPdpNavExtrasHtml(input: {
  locale: WebLocale
  siteSlug?: string | null
  logoUrl?: string | null
  chatIconLogoUrl?: string | null
  existing?: Record<string, string>
}): string {
  return CHROME_KIT_DOCK_ITEMS.filter(
    (item) => item.slot === 'icon' && !CHROME_KIT_PDP_NAV_DEFAULT_KINDS.includes(item.kind as (typeof CHROME_KIT_PDP_NAV_DEFAULT_KINDS)[number])
  )
    .map((item) => input.existing?.[item.kind] || buildDockPdpExtraIconHtml(item.kind, input))
    .filter(Boolean)
    .join('\n      ')
}

function buildDockPdpFaceHtml(input: {
  locale: WebLocale
  siteSlug?: string | null
  logoUrl?: string | null
  chatIconLogoUrl?: string | null
  nav?: { home?: string; tryOn?: string; favorite?: string }
  extras?: Record<string, string>
  ctas?: { addCart?: string; buyNow?: string }
}): string {
  const navHome = input.nav?.home || buildDockPdpHomeHtml(input.locale, input.siteSlug)
  const navTry = input.nav?.tryOn || buildDockPdpTryOnHtml(input.locale)
  const navFav = input.nav?.favorite || buildDockPdpFavoriteHtml(input.locale)
  const extras = buildDockPdpNavExtrasHtml({
    locale: input.locale,
    siteSlug: input.siteSlug,
    logoUrl: input.logoUrl,
    chatIconLogoUrl: input.chatIconLogoUrl,
    existing: input.extras,
  })
  const addCart = stampPdpCtaLockAttrs(input.ctas?.addCart || buildDockPdpCtaHtml('add-cart', input.locale))
  const buyNow = stampPdpCtaLockAttrs(input.ctas?.buyNow || buildDockPdpCtaHtml('buy-now', input.locale))
  return `<div class="pw-pdp-sticky-nav" ${PW_DOCK_SHOW_ATTR}="pdp">
      ${navHome}
      ${navTry}
      ${navFav}
      ${extras}
    </div>
    <div class="pw-pdp-sticky-ctas" ${PW_DOCK_SHOW_ATTR}="pdp">
      ${addCart}
      ${buyNow}
    </div>`
}

function buildChromeKitShopDockItemHtml(
  item: ChromeKitDockItem,
  input: {
    locale: WebLocale
    siteSlug?: string | null
    logoUrl?: string | null
    chatIconLogoUrl?: string | null
    device?: VisualDeviceVariant | null
  }
): string {
  if (item.kind === 'try-on' || item.kind === 'favorite-product' || isPdpDockCtaLocked(item.kind)) return ''
  const raw = buildVisualEditorChromeWidgetHtml({
    kind: item.kind,
    siteSlug: slugOrShop(input.siteSlug),
    locale: input.locale,
    style: 'icon-label-below',
    place: 'nav',
    logoUrl: input.logoUrl,
    chatIconLogoUrl: input.chatIconLogoUrl,
    iconSize: chromeDockIconSizeForDevice(input.device),
  })
  if (!raw) return ''
  return asKitTag(raw, `${dockShowAttr(item.defaultShow)} ${PW_DOCK_SLOT_ATTR}="${item.slot}"`)
}

export function buildChromeKitDockHtml(input: {
  locale: WebLocale
  siteSlug?: string | null
  logoUrl?: string | null
  chatIconLogoUrl?: string | null
  device?: VisualDeviceVariant | null
}): string {
  const shopItems = CHROME_KIT_DOCK_ITEMS.map((item) => buildChromeKitShopDockItemHtml(item, input))
    .filter(Boolean)
    .join('\n    ')
  return `${shopItems}
    ${buildDockPdpFaceHtml({ locale: input.locale, siteSlug: input.siteSlug })}`
}

export function buildChromeKitFloatHtml(input: {
  locale: WebLocale
  siteSlug?: string | null
  logoUrl?: string | null
  chatIconLogoUrl?: string | null
  device?: VisualDeviceVariant | null
}): string {
  const slug = slugOrShop(input.siteSlug)
  const iconSize = chromeFloatRhythmForDevice(input.device).size
  return CHROME_KIT_FLOAT_ITEMS.map((item) => {
    const raw = buildVisualEditorChromeWidgetHtml({
      kind: item.kind,
      siteSlug: slug,
      locale: input.locale,
      style: 'icon-circle',
      place: 'nav',
      logoUrl: input.logoUrl,
      chatIconLogoUrl: input.chatIconLogoUrl,
      iconSize,
    })
    if (!raw) return ''
    return asFloatKitTag(raw, hiddenAttr(item.defaultOn))
  })
    .filter(Boolean)
    .join('\n    ')
}

export function buildChromeKitFloatHostHtml(input: {
  locale: WebLocale
  siteSlug?: string | null
  logoUrl?: string | null
  chatIconLogoUrl?: string | null
  inner?: string
  device?: VisualDeviceVariant | null
}): string {
  const rhythm = chromeFloatRhythmForDevice(input.device)
  const inner = (input.inner || buildChromeKitFloatHtml(input)).trim()
  return `<aside class="pw-chrome-float-kit" ${PW_CHROME_KIT_ATTR}="float" data-pw-chrome-float-host="1" ${PW_FLOAT_RIGHT_ATTR}="${rhythm.right}" ${PW_FLOAT_STACK_BOTTOM_ATTR}="${rhythm.bottom}" ${PW_FLOAT_GAP_ATTR}="${rhythm.gap}" ${PW_FLOAT_SIZE_ATTR}="${rhythm.size}" style="--pw-float-size:${rhythm.size}px">\n    ${inner}\n  </aside>`
}

/**
 * Chỉ nhận diện trang chi tiết bằng `data-pw-page="product"`.
 * Cấm `:has([data-pw-pdp-add-cart])` / `:has([data-pw-region="gallery"])`:
 * kit dock mọi trang đều chứa nút Thêm giỏ PDP → trang chủ bị ẩn mặt shop.
 */
export const PW_PRODUCT_PAGE_CSS_HOSTS = [
  'html:has([data-pw-page="product"])',
  'html[data-pw-page="product"]',
  '[data-pw-page="product"]',
] as const

function pwProductDockCss(selector: string, body: string): string {
  return `${PW_PRODUCT_PAGE_CSS_HOSTS.flatMap((host) => [
    `${host} .pw-bottom-nav${selector}`,
    `${host} .pw-shop-bottom-nav${selector}`,
  ]).join(',')}${body}`
}

export const PARTNER_SHOP_CHROME_KIT_CSS = `
.pw-header-actions[${PW_CHROME_KIT_ATTR}="actions"],.pw-shop-header-actions[${PW_CHROME_KIT_ATTR}="actions"]{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;margin-right:0!important;gap:var(--pw-kit-gap, ${PW_KIT_GAP_DEFAULT}px)!important;transform:translateX(var(--pw-kit-x, 0px))!important}
.pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"],.pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"]{flex-wrap:nowrap!important;align-items:stretch}
.pw-bottom-nav .pw-pdp-sticky-nav,.pw-shop-bottom-nav .pw-pdp-sticky-nav,.pw-bottom-nav .pw-pdp-sticky-ctas,.pw-shop-bottom-nav .pw-pdp-sticky-ctas,
.pw-bottom-nav [${PW_DOCK_SHOW_ATTR}="pdp"],.pw-shop-bottom-nav [${PW_DOCK_SHOW_ATTR}="pdp"]{display:none!important}
html:not([data-pw-page="product"]):not(:has([data-pw-page="product"])) .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] > [data-pw-chrome-btn="home"]:not([${PW_PDP_HOME_ATTR}]):not([${PW_HIDDEN_ATTR}="1"]):not([${PW_DOCK_SHOW_ATTR}="pdp"]),
html:not([data-pw-page="product"]):not(:has([data-pw-page="product"])) .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] > [data-pw-chrome-btn="home"]:not([${PW_PDP_HOME_ATTR}]):not([${PW_HIDDEN_ATTR}="1"]):not([${PW_DOCK_SHOW_ATTR}="pdp"]){
  display:flex!important;flex-direction:column;align-items:center;justify-content:center;flex:1 1 0!important;min-width:0!important
}
html:not([data-pw-page="product"]):not(:has([data-pw-page="product"])) .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] > [data-pw-chrome-btn="home"]:not([${PW_PDP_HOME_ATTR}]):not([${PW_DOCK_SHOW_ATTR}="pdp"]) ~ [data-pw-chrome-btn="home"]:not([${PW_PDP_HOME_ATTR}]):not([${PW_HIDDEN_ATTR}="1"]):not([${PW_DOCK_SHOW_ATTR}="pdp"]),
html:not([data-pw-page="product"]):not(:has([data-pw-page="product"])) .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] > [data-pw-chrome-btn="home"]:not([${PW_PDP_HOME_ATTR}]):not([${PW_DOCK_SHOW_ATTR}="pdp"]) ~ [data-pw-chrome-btn="home"]:not([${PW_PDP_HOME_ATTR}]):not([${PW_HIDDEN_ATTR}="1"]):not([${PW_DOCK_SHOW_ATTR}="pdp"]){
  display:none!important
}
${pwProductDockCss(` [${PW_DOCK_SHOW_ATTR}="shop"]`, '{display:none!important}')}
${pwProductDockCss(
  `[${PW_CHROME_KIT_ATTR}="dock"] > a:not([${PW_DOCK_SHOW_ATTR}="pdp"]):not([${PW_DOCK_SHOW_ATTR}="both"])`,
  '{display:none!important}',
)}
${pwProductDockCss(
  `[${PW_CHROME_KIT_ATTR}="dock"] > button:not([${PW_DOCK_SHOW_ATTR}="pdp"]):not([${PW_DOCK_SHOW_ATTR}="both"])`,
  '{display:none!important}',
)}
${pwProductDockCss(
  `[${PW_CHROME_KIT_ATTR}="dock"] > [${PW_DOCK_SHOW_ATTR}="pdp"]:not(.pw-pdp-sticky-nav):not(.pw-pdp-sticky-ctas):not([${PW_HIDDEN_ATTR}="1"])`,
  '{display:flex!important;flex-direction:column;align-items:center;justify-content:center}',
)}
${pwProductDockCss(
  `[${PW_CHROME_KIT_ATTR}="dock"] > [${PW_DOCK_SHOW_ATTR}="both"]:not(.pw-pdp-sticky-nav):not(.pw-pdp-sticky-ctas):not([${PW_HIDDEN_ATTR}="1"])`,
  '{display:flex!important;flex-direction:column;align-items:center;justify-content:center}',
)}
${pwProductDockCss(`[${PW_CHROME_KIT_ATTR}="dock"]`, `{
  justify-content:flex-start!important;align-items:stretch!important;gap:4px!important;min-height:48px!important;
  padding:2px 2px calc(2px + env(safe-area-inset-bottom,0px))!important;background:#f3f4f6!important;border-top:1px solid #e5e7eb!important
}`)}
${pwProductDockCss(' .pw-pdp-sticky-nav', '{display:flex!important;flex-direction:row!important;align-items:stretch;gap:1px;flex:0 0 auto;padding-right:6px;margin-right:2px;border-right:1px solid #e5e7eb}')}
${pwProductDockCss(' .pw-pdp-sticky-ctas', '{display:flex!important;flex-direction:row!important;flex:1;min-width:0;gap:4px}')}
${pwProductDockCss(` .pw-pdp-sticky-nav [${PW_HIDDEN_ATTR}="1"]`, '{display:none!important}')}
${pwProductDockCss(' .pw-pdp-sticky-nav .pw-chrome-cat-wrap:has(> [data-pw-hidden="1"]):not(:has([data-pw-pdp-nav="1"]:not([data-pw-hidden="1"])))', '{display:none!important}')}
${pwProductDockCss(` .pw-pdp-sticky-nav [${PW_DOCK_SHOW_ATTR}="pdp"]:not([${PW_HIDDEN_ATTR}="1"])`, '{display:flex!important;flex-direction:column;flex:0 0 44px!important;width:44px!important;gap:2px!important;padding:2px 0!important;font-size:10px!important;line-height:1.05!important;color:#4b5563!important;background:transparent!important}')}
${pwProductDockCss(` .pw-pdp-sticky-ctas [${PW_DOCK_SHOW_ATTR}="pdp"]`, '{display:flex!important;flex:1 1 0!important;min-height:40px;align-items:center;justify-content:center;padding:0 8px!important;font-size:11px!important;font-weight:600!important;text-transform:uppercase;border-radius:6px!important;color:#fff!important}')}
${pwProductDockCss(' .pw-pdp-sticky-nav svg', '{width:17px!important;height:17px!important;max-width:17px!important;max-height:17px!important}')}
${pwProductDockCss(' .pw-pdp-sticky-nav [data-pw-chrome-btn="home"] ~ [data-pw-chrome-btn="home"]', '{display:none!important}')}
${pwProductDockCss(' .pw-pdp-sticky-nav [data-pw-chrome-btn="try-on"] ~ [data-pw-chrome-btn="try-on"]', '{display:none!important}')}
${pwProductDockCss(' .pw-pdp-sticky-nav [data-pw-chrome-btn="favorite-product"] ~ [data-pw-chrome-btn="favorite-product"]', '{display:none!important}')}
${pwProductDockCss(' .pw-pdp-sticky-ctas [data-pw-chrome-btn="add-cart"] ~ [data-pw-chrome-btn="add-cart"]', '{display:none!important}')}
${pwProductDockCss(' .pw-pdp-sticky-ctas [data-pw-chrome-btn="buy-now"] ~ [data-pw-chrome-btn="buy-now"]', '{display:none!important}')}
${pwProductDockCss(' .pw-shop-btn-outline', '{display:none!important}')}
${pwProductDockCss(`[${PW_CHROME_KIT_ATTR}="dock"] [data-pw-chrome-btn="add-cart"]`, '{background:var(--pw-cart)!important;color:#fff!important}')}
${pwProductDockCss(`[${PW_CHROME_KIT_ATTR}="dock"] [data-pw-chrome-btn="buy-now"]`, '{background:var(--pw-buy)!important;color:#fff!important}')}
${pwProductDockCss(`[${PW_CHROME_KIT_ATTR}="dock"] .is-try`, '{color:var(--pw-primary)!important}')}
${pwProductDockCss(`[${PW_CHROME_KIT_ATTR}="dock"] .is-fav[aria-pressed="true"]`, '{color:#e11d48!important}')}
${pwProductDockCss(`[${PW_CHROME_KIT_ATTR}="dock"] .is-fav[aria-pressed="true"] svg`, '{fill:currentColor!important}')}
${pwProductDockCss(`[${PW_CHROME_KIT_ATTR}="dock"] ~ .pw-bottom-nav[data-pw-pdp-bottom]:not([${PW_CHROME_KIT_ATTR}])`, '{display:none!important}')}
${pwProductDockCss(`[${PW_CHROME_KIT_ATTR}="dock"] ~ .pw-shop-bottom-nav[data-pw-pdp-bottom]:not([${PW_CHROME_KIT_ATTR}])`, '{display:none!important}')}
html:has([${PW_CHROME_KIT_ATTR}="dock"]) .pw-pdp-sticky-nav:not([${PW_CHROME_KIT_ATTR}="dock"] .pw-pdp-sticky-nav),
html:has([${PW_CHROME_KIT_ATTR}="dock"]) .pw-pdp-sticky-ctas:not([${PW_CHROME_KIT_ATTR}="dock"] .pw-pdp-sticky-ctas),
html[data-pw-page="product"]:has([${PW_CHROME_KIT_ATTR}="dock"]) > body > .pw-pdp-sticky-nav,
html[data-pw-page="product"]:has([${PW_CHROME_KIT_ATTR}="dock"]) > body > .pw-pdp-sticky-ctas,
html[data-pw-page="product"]:has([${PW_CHROME_KIT_ATTR}="dock"]) > body > [data-pw-dock-show="pdp"],
html[data-pw-page="product"]:has([${PW_CHROME_KIT_ATTR}="dock"]) > body > [data-pw-chrome-btn="add-cart"],
html[data-pw-page="product"]:has([${PW_CHROME_KIT_ATTR}="dock"]) > body > [data-pw-chrome-btn="buy-now"],
html[data-pw-page="product"]:has([${PW_CHROME_KIT_ATTR}="dock"]) > body > [data-pw-chrome-btn="try-on"],
html[data-pw-page="product"]:has([${PW_CHROME_KIT_ATTR}="dock"]) > body > [data-pw-chrome-btn="favorite-product"],
html[data-pw-page="product"] .pw-shop-cat-panel .pw-pdp-sticky-nav,
html[data-pw-page="product"] .pw-shop-cat-panel .pw-pdp-sticky-ctas,
html[data-pw-page="product"] .pw-chrome-cat-wrap > .pw-pdp-sticky-nav,
html[data-pw-page="product"] .pw-chrome-cat-wrap > .pw-pdp-sticky-ctas,
html[data-pw-page="product"] header [data-pw-chrome-btn="try-on"],
html[data-pw-page="product"] header [data-pw-chrome-btn="favorite-product"],
html[data-pw-page="product"] header [data-pw-chrome-btn="add-cart"],
html[data-pw-page="product"] header [data-pw-chrome-btn="buy-now"],
html[data-pw-page="product"] header .pw-pdp-sticky-nav,
html[data-pw-page="product"] header .pw-pdp-sticky-ctas,
html[data-pw-page="product"] header [data-pw-pdp-nav],
html[data-pw-page="product"] header [data-pw-dock-show="pdp"],
html[data-pw-page="product"] .pw-header [data-pw-chrome-btn="try-on"],
html[data-pw-page="product"] .pw-shop-header [data-pw-chrome-btn="try-on"],
html[data-pw-page="product"] .pw-header [data-pw-chrome-btn="favorite-product"],
html[data-pw-page="product"] .pw-shop-header [data-pw-chrome-btn="favorite-product"],
html[data-pw-page="product"] [data-pw-live-chrome] [data-pw-chrome-btn="try-on"],
html[data-pw-page="product"] [data-pw-live-chrome] [data-pw-chrome-btn="favorite-product"],
html[data-pw-page="product"] [data-pw-live-chrome] [data-pw-chrome-btn="add-cart"],
html[data-pw-page="product"] [data-pw-live-chrome] [data-pw-chrome-btn="buy-now"],
html[data-pw-page="product"] [data-pw-live-chrome] .pw-pdp-sticky-nav,
html[data-pw-page="product"] [data-pw-live-chrome] .pw-pdp-sticky-ctas{display:none!important}
html:has([${PW_CHROME_KIT_ATTR}="dock"]) nav[data-pw-pdp-bottom]:not([${PW_CHROME_KIT_ATTR}]),
html:has([${PW_CHROME_KIT_ATTR}="dock"]) nav.pw-pdp-sticky:not([${PW_CHROME_KIT_ATTR}]),
html:has([${PW_CHROME_KIT_ATTR}="dock"]) div.pw-pdp-sticky,
.pw-shop:has([${PW_CHROME_KIT_ATTR}="dock"]) nav[data-pw-pdp-bottom]:not([${PW_CHROME_KIT_ATTR}]),
.pw-shop:has([${PW_CHROME_KIT_ATTR}="dock"]) nav.pw-pdp-sticky:not([${PW_CHROME_KIT_ATTR}]),
.pw-shop:has([${PW_CHROME_KIT_ATTR}="dock"]) div.pw-pdp-sticky{display:none!important}
.pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"],.pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"]{
  justify-content:stretch!important;gap:0!important;min-height:${PW_DOCK_BAR_MIN_H.tablet}px!important;
  padding:6px 2px calc(6px + env(safe-area-inset-bottom,0px))!important;background:#fff!important;border-top:1px solid var(--pw-border,#e5e7eb)!important
}
.pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] > [${PW_CHROME_KIT_ATTR}="1"]:not([${PW_HIDDEN_ATTR}="1"]),.pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] > [${PW_CHROME_KIT_ATTR}="1"]:not([${PW_HIDDEN_ATTR}="1"]){
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
[${PW_CHROME_KIT_ATTR}="1"]:not([data-pw-user-move]):not([data-pw-chrome-float="1"]){position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;transform:none!important}
[${PW_CHROME_KIT_ATTR}="float"]{
  display:contents
}
[${PW_CHROME_KIT_ATTR}="float"] > [${PW_CHROME_KIT_ATTR}="1"]:not([${PW_HIDDEN_ATTR}="1"]){pointer-events:auto}
[data-pw-chrome-added="1"][data-pw-chrome-btn]:not([data-pw-chrome-kit]){z-index:${pwSceneZ(PW_MID_CANVAS_TOP_SCENE)}!important}
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
const BOTTOM_NAV_OPEN_RE =
  /<nav([^>]*class=["'][^"']*\b(?:pw-bottom-nav|pw-shop-bottom-nav)\b[^"']*["'][^>]*)>/gi
/** Leftover 188 PDP bar only — not kit host, not inner `.pw-pdp-sticky-nav` / `-ctas`. */
const PDP_BOTTOM_NAV_RE =
  /<(nav|div)(?=[^>]*(?:\bdata-pw-pdp-bottom=|["'\s]pw-pdp-sticky["'\s]))(?![^>]*\bdata-pw-chrome-kit=)[^>]*>[\s\S]*?<\/\1>/gi

function isHtmlTagNameEnd(ch: string | undefined): boolean {
  return ch === ' ' || ch === '>' || ch === '/' || ch === '\n' || ch === '\r' || ch === '\t'
}

function extractBalancedTag(
  html: string,
  tag: string,
  start: number
): { full: string; inner: string; open: string; start: number } | null {
  const openEnd = html.indexOf('>', start)
  if (openEnd < 0) return null
  const open = html.slice(start, openEnd + 1)
  if (/\/\s*>$/.test(open)) return { full: open, inner: '', open, start }
  const openTok = `<${tag}`
  const closeTok = `</${tag}>`
  const lower = html.toLowerCase()
  let i = openEnd + 1
  let depth = 1
  while (i < html.length && depth > 0) {
    const nextOpen = lower.indexOf(openTok, i)
    const nextClose = lower.indexOf(closeTok, i)
    if (nextClose < 0) return null
    const openIsTag =
      nextOpen >= 0 &&
      nextOpen < nextClose &&
      isHtmlTagNameEnd(lower[nextOpen + openTok.length])
    if (openIsTag) {
      depth += 1
      i = nextOpen + openTok.length
      continue
    }
    depth -= 1
    i = nextClose + closeTok.length
  }
  return { full: html.slice(start, i), inner: html.slice(openEnd + 1, i - closeTok.length), open, start }
}

function replaceBalancedBottomNavs(
  html: string,
  replacer: (attrs: string, inner: string, full: string) => string
): string {
  let out = ''
  let cursor = 0
  const openRe = new RegExp(BOTTOM_NAV_OPEN_RE.source, 'gi')
  while (cursor < html.length) {
    openRe.lastIndex = cursor
    const found = openRe.exec(html)
    if (!found || found.index == null) {
      out += html.slice(cursor)
      break
    }
    const hit = extractBalancedTag(html, 'nav', found.index)
    if (!hit) {
      out += html.slice(cursor, found.index + found[0].length)
      cursor = found.index + found[0].length
      continue
    }
    out += html.slice(cursor, hit.start)
    out += replacer(found[1] || '', hit.inner, hit.full)
    cursor = hit.start + hit.full.length
  }
  return out
}

function isLeftoverPdpBarAttrs(attrs: string): boolean {
  if (new RegExp(`${PW_CHROME_KIT_ATTR}=["']dock["']`, 'i').test(attrs)) return false
  if (/data-pw-pdp-bottom=/i.test(attrs)) return true
  return /["'\s]pw-pdp-sticky["'\s]/.test(attrs)
}

function leftoverPdpBarOpenTag(block: string): string {
  return block.match(/^<(nav|div)\b[^>]*>/i)?.[0] || ''
}

function hoistViewportDockToBody(html: string): string {
  if (!/<\/body>/i.test(html)) return html
  const docks: string[] = []
  const out = replaceBalancedBottomNavs(html, (_attrs, _inner, full) => {
    docks.push(full)
    return ''
  })
  if (!docks.length) return html
  const picked =
    docks.find((d) => /data-pw-chrome-kit=["']dock["']/i.test(d) && /pw-pdp-sticky-nav/i.test(d)) ||
    docks.find((d) => /data-pw-chrome-kit=["']dock["']/i.test(d)) ||
    docks[docks.length - 1]
  if (!picked) return html
  return out.replace(/<\/body>/i, `${picked}\n</body>`)
}

function keepPdpBarBlock(block: string): boolean {
  const open = leftoverPdpBarOpenTag(block)
  return new RegExp(`${PW_CHROME_KIT_ATTR}=["']dock["']`, 'i').test(open)
}

function isInsideKitDock(html: string, index: number): boolean {
  const before = html.slice(0, index)
  const re = /<nav\b[^>]*\bdata-pw-chrome-kit=["']dock["'][^>]*>/gi
  let lastOpen = -1
  let found: RegExpExecArray | null
  while ((found = re.exec(before))) lastOpen = found.index
  if (lastOpen < 0) return false
  const hit = extractBalancedTag(html, 'nav', lastOpen)
  if (!hit) return true
  return index < hit.start + hit.full.length
}

function findNextPdpFaceBlock(
  html: string,
  className: string,
  from: number,
  exact = false
): { full: string; start: number } | null {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = exact
    ? new RegExp(`<(div|nav)\\b[^>]*\\bclass=["'][^"']*\\b${escaped}\\b(?![-\\w])[^"']*["'][^>]*>`, 'gi')
    : new RegExp(`<(div|nav)\\b[^>]*\\b${escaped}\\b[^>]*>`, 'gi')
  re.lastIndex = from
  const found = re.exec(html)
  if (!found || found.index == null) return null
  const hit = extractBalancedTag(html, (found[1] || 'div').toLowerCase(), found.index)
  return hit ? { full: hit.full, start: hit.start } : null
}

function isInsideStockTopbarHtml(html: string, index: number): boolean {
  const before = html.slice(0, index)
  const re = /<(div)\b[^>]*>/gi
  let last = -1
  let found: RegExpExecArray | null
  while ((found = re.exec(before))) {
    const open = found[0]
    if (/\b(?:pw-topbar-inner|pw-shop-topbar-inner)\b/.test(open)) continue
    if (/\b(?:pw-topbar|pw-shop-topbar)\b/.test(open) || /\bdata-pw-region=["']topbar["']/.test(open)) {
      last = found.index
    }
  }
  if (last < 0) return false
  const hit = extractBalancedTag(html, 'div', last)
  if (!hit) return true
  return index > hit.start && index < hit.start + hit.full.length
}

function isInsideChromeKitHostHtml(html: string, index: number): boolean {
  const before = html.slice(0, index)
  const re = /<(aside|div|nav|header)\b[^>]*\bdata-pw-chrome-kit=["'](?:actions|dock|float)["'][^>]*>/gi
  let last = -1
  let found: RegExpExecArray | null
  while ((found = re.exec(before))) last = found.index
  if (last < 0) return false
  const tag = before.slice(last).match(/^<(aside|div|nav|header)\b/i)?.[1]?.toLowerCase()
  if (!tag) return false
  const hit = extractBalancedTag(html, tag, last)
  if (!hit) return true
  return index < hit.start + hit.full.length
}

function isEscapedTopbarTextLinkAttrs(attrs: string): boolean {
  if (/\bdata-pw-chrome-kit=["'](?:actions|dock|float)["']/i.test(attrs)) return false
  const textFace = /\bdata-pw-chrome-style=["']text["']/i.test(attrs) || !/\bdata-pw-chrome-style=/.test(attrs)
  if (!textFace) return false
  return (
    /\bdata-pw-chrome-added=/.test(attrs) ||
    /\bdata-pw-user-move=/.test(attrs) ||
    /\bdata-pw-placement=["']scene-absolute["']/i.test(attrs) ||
    /\bdata-pw-device=/.test(attrs)
  )
}

function shouldStripEscapedHeadLink(html: string, index: number, attrs: string, kind: string): boolean {
  if (isInsideStockTopbarHtml(html, index) || isInsideChromeKitHostHtml(html, index)) return false
  if (kind === 'favorites-link') return true
  return isEscapedTopbarTextLinkAttrs(attrs)
}

/** Topbar / Yêu thích bị kéo lên `main` — leftover máy khác, xóa sạch. */
export function stripEscapedHeadChromeLeftoversInHtml(html: string): string {
  if (!html.trim()) return html
  let next = html.replace(
    /<(a|button)\b([^>]*\bdata-pw-chrome-btn=["'](favorites-link|login|contact)["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    (full, _tag: string, attrs: string, kind: string, _inner: string, offset: number) =>
      shouldStripEscapedHeadLink(html, offset, attrs, kind) ? '' : full
  )
  let from = 0
  for (let guard = 0; guard < 24; guard += 1) {
    const re = /<(div)\b[^>]*\b(?:pw-topbar-inner|pw-shop-topbar-inner)\b[^>]*>/gi
    re.lastIndex = from
    const found = re.exec(next)
    if (!found || found.index == null) break
    if (isInsideStockTopbarHtml(next, found.index)) {
      from = found.index + found[0].length
      continue
    }
    const hit = extractBalancedTag(next, 'div', found.index)
    if (!hit) {
      from = found.index + found[0].length
      continue
    }
    next = `${next.slice(0, hit.start)}${next.slice(hit.start + hit.full.length)}`
    from = hit.start
  }
  return next
}

/** Leftover 188 face after footer — not the kit dock children. */
function stripLeftoverPdpFaceOutsideDock(html: string): string {
  if (!new RegExp(`${PW_CHROME_KIT_ATTR}=["']dock["']`, 'i').test(html)) return html
  let next = html
  const specs: Array<{ cls: string; exact?: boolean }> = [
    { cls: 'pw-pdp-sticky', exact: true },
    { cls: 'pw-pdp-sticky-ctas' },
    { cls: 'pw-pdp-sticky-nav' },
  ]
  for (const spec of specs) {
    let from = 0
    let guard = 0
    while (guard < 40) {
      guard += 1
      const hit = findNextPdpFaceBlock(next, spec.cls, from, spec.exact)
      if (!hit) break
      if (isInsideKitDock(next, hit.start)) {
        from = hit.start + hit.full.length
        continue
      }
      next = `${next.slice(0, hit.start)}${next.slice(hit.start + hit.full.length)}`
    }
  }
  return next
}

function htmlHasChromeKind(html: string, kind: string): boolean {
  const re = new RegExp(`data-pw-chrome-btn=["']${kind}["']`, 'i')
  return re.test(html)
}

function chromeOpenTagsOfKind(html: string, kind: string): string[] {
  const re = new RegExp(`<(?:a|button)\\b[^>]*\\bdata-pw-chrome-btn=["']${kind}["'][^>]*>`, 'gi')
  return html.match(re) || []
}

function isPdpOnlyDockOpenTag(tag: string): boolean {
  if (new RegExp(`\\b${PW_PDP_HOME_ATTR}=`, 'i').test(tag)) return true
  if (new RegExp(`\\b${PW_PDP_NAV_ATTR}=`, 'i').test(tag)) return true
  return new RegExp(`\\b${PW_DOCK_SHOW_ATTR}=["']pdp["']`, 'i').test(tag)
}

/** Trang chủ shop — Home trong mặt PDP (`data-pw-pdp-home` / dock-show=pdp) không tính. */
function htmlHasShopDockKind(html: string, kind: string): boolean {
  return chromeOpenTagsOfKind(html, kind).some((tag) => !isPdpOnlyDockOpenTag(tag))
}

function stampExistingKitAttrs(inner: string, bar: 'head' | 'dock' | 'float'): string {
  return inner.replace(/<(a|button)(\s[^>]*?)>/gi, (full, tag: string, attrs: string) => {
    const kind = attrs.match(/\bdata-pw-chrome-btn=["']([^"']+)["']/i)?.[1] || ''
    if (!kind) return full
    if (bar === 'head' && !HEAD_ACTION_KIND_SET.has(kind as VisualEditorChromeWidgetKind)) return full
    if (bar === 'dock' && !DOCK_KIND_SET.has(kind as VisualEditorChromeWidgetKind)) return full
    if (bar === 'float' && !FLOAT_KIND_SET.has(kind as PwChromeFloatKind)) return full
    let next = attrs
      .replace(/\sdata-pw-chrome-added=(["'])[^"']*\1/gi, '')
      .replace(/\sdata-pw-user-move=(["'])[^"']*\1/gi, '')
      .replace(/\sdata-pw-placement=(["'])[^"']*\1/gi, '')
      .replace(/\sdata-pw-box-[xywh]=(["'])[^"']*\1/gi, '')
      .replace(/\sdata-pw-fixed-(?:x|y|w|h)=(["'])[^"']*\1/gi, '')
    if (bar !== 'float') {
      next = next.replace(/\sdata-pw-chrome-float=(["'])[^"']*\1/gi, '')
    } else if (!/\bdata-pw-chrome-float=/i.test(next)) {
      next += ' data-pw-chrome-float="1"'
    }
    if (!new RegExp(`\\b${PW_CHROME_KIT_ATTR}=`, 'i').test(next)) next += ` ${PW_CHROME_KIT_ATTR}="1"`
    if (bar === 'dock') {
      const spec = CHROME_KIT_DOCK_ITEMS.find((item) => item.kind === kind)
      const isPdpHome = new RegExp(`\\b${PW_PDP_HOME_ATTR}=`, 'i').test(next)
      if (spec && !new RegExp(`\\b${PW_DOCK_SHOW_ATTR}=`, 'i').test(next)) {
        if (isPdpDockCtaLocked(kind) || kind === 'try-on' || kind === 'favorite-product' || isPdpHome) {
          next += ` ${PW_DOCK_SHOW_ATTR}="pdp"`
        } else {
          next += spec.defaultShow === 'off' ? ` ${PW_DOCK_SHOW_ATTR}="shop"` : ` ${PW_DOCK_SHOW_ATTR}="${spec.defaultShow === 'both' ? 'shop' : spec.defaultShow}"`
        }
      }
      if (spec && !new RegExp(`\\b${PW_DOCK_SLOT_ATTR}=`, 'i').test(next)) {
        next += ` ${PW_DOCK_SLOT_ATTR}="${spec.slot}"`
      }
      if (isPdpDockCtaLocked(kind) && !new RegExp(`\\b${PW_KIT_LOCK_ATTR}=`, 'i').test(next)) {
        next += ` ${PW_KIT_LOCK_ATTR}="cta"`
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

function withHostKitAttr(openAttrs: string, value: 'actions' | 'dock' | 'float'): string {
  if (new RegExp(`\\b${PW_CHROME_KIT_ATTR}=`, 'i').test(openAttrs)) {
    return openAttrs.replace(new RegExp(`\\s${PW_CHROME_KIT_ATTR}=(["'])[^"']*\\1`, 'i'), ` ${PW_CHROME_KIT_ATTR}="${value}"`)
  }
  return `${openAttrs} ${PW_CHROME_KIT_ATTR}="${value}"`
}

function writeFloatSizeCss(openAttrs: string, size: number): string {
  const n = clampChromeFloatSize(size)
  const styleMatch = openAttrs.match(/\sstyle=(["'])([\s\S]*?)\1/i)
  const quote = styleMatch?.[1] || '"'
  let css = String(styleMatch?.[2] || '')
    .replace(/(?:^|;)\s*--pw-float-size\s*:[^;]*/gi, '')
    .replace(/^;+|;+$/g, '')
    .trim()
  const nextCss = css ? `${css};--pw-float-size:${n}px` : `--pw-float-size:${n}px`
  if (styleMatch) return openAttrs.replace(/\sstyle=(["'])([\s\S]*?)\1/i, ` style=${quote}${nextCss}${quote}`)
  return `${openAttrs} style=${quote}${nextCss}${quote}`
}

function withFloatStackHostAttrs(openAttrs: string, device?: VisualDeviceVariant | null): string {
  const rhythm = chromeFloatRhythmForDevice(device)
  let next = openAttrs
  if (!new RegExp(`\\b${PW_FLOAT_RIGHT_ATTR}=`, 'i').test(next)) {
    next += ` ${PW_FLOAT_RIGHT_ATTR}="${rhythm.right}"`
  }
  if (!new RegExp(`\\b${PW_FLOAT_STACK_BOTTOM_ATTR}=`, 'i').test(next)) {
    next += ` ${PW_FLOAT_STACK_BOTTOM_ATTR}="${rhythm.bottom}"`
  }
  if (!new RegExp(`\\b${PW_FLOAT_GAP_ATTR}=`, 'i').test(next)) {
    next += ` ${PW_FLOAT_GAP_ATTR}="${rhythm.gap}"`
  }
  const hadSize = new RegExp(`\\b${PW_FLOAT_SIZE_ATTR}=`, 'i').test(next)
  const fromAttr = next.match(new RegExp(`\\b${PW_FLOAT_SIZE_ATTR}=(["'])([^"']*)\\1`, 'i'))?.[2]
  const fromCss = next.match(/--pw-float-size\s*:\s*(-?\d+(?:\.\d+)?)px/i)?.[1]
  const size = clampChromeFloatSize(fromAttr ?? fromCss ?? rhythm.size)
  if (!hadSize) next += ` ${PW_FLOAT_SIZE_ATTR}="${size}"`
  else {
    next = next.replace(new RegExp(`\\s${PW_FLOAT_SIZE_ATTR}=(["'])[^"']*\\1`, 'i'), ` ${PW_FLOAT_SIZE_ATTR}="${size}"`)
  }
  return writeFloatSizeCss(next, size)
}

function floatHostSizeFromAttrs(openAttrs: string): number {
  const fromAttr = openAttrs.match(new RegExp(`\\b${PW_FLOAT_SIZE_ATTR}=(["'])([^"']*)\\1`, 'i'))?.[2]
  const fromCss = openAttrs.match(/--pw-float-size\s*:\s*(-?\d+(?:\.\d+)?)px/i)?.[1]
  return clampChromeFloatSize(fromAttr ?? fromCss ?? PW_FLOAT_SIZE_DEFAULT)
}

function stampFloatKitFaceAndSize(inner: string, size: number, migrateCircle: boolean): string {
  const fallback = clampChromeFloatSize(size)
  return inner.replace(/<(a|button)(\s[^>]*?)>/gi, (full, tag: string, attrs: string) => {
    const kind = attrs.match(/\bdata-pw-chrome-btn=["']([^"']+)["']/i)?.[1] || ''
    if (!FLOAT_KIND_SET.has(kind as PwChromeFloatKind)) return full
    let next = attrs
    const style = (next.match(/\bdata-pw-chrome-style=["']([^"']+)["']/i)?.[1] || '').toLowerCase()
    if (migrateCircle && (!style || style === 'icon')) {
      if (/\bdata-pw-chrome-style=/i.test(next)) {
        next = next.replace(/\sdata-pw-chrome-style=(["'])[^"']*\1/gi, ' data-pw-chrome-style="icon-circle"')
      } else {
        next += ' data-pw-chrome-style="icon-circle"'
      }
      if (/\bclass=/i.test(next)) {
        next = next.replace(/\sclass=(["'])([^"']*)\1/i, (_m, q: string, cls: string) => {
          const cleaned = String(cls)
            .replace(/\bpw-chrome-icon-square\b/g, '')
            .replace(/\bpw-chrome-has-label\b/g, '')
            .replace(/\bpw-chrome-label-below\b/g, '')
            .replace(/\bpw-chrome-label-left\b/g, '')
            .replace(/\bpw-chrome-link\b/g, '')
            .replace(/\bpw-chrome-icon-only\b/g, '')
            .replace(/\bpw-chrome-icon-circle\b/g, '')
            .replace(/\s+/g, ' ')
            .trim()
          return ` class=${q}${cleaned}${cleaned ? ' ' : ''}pw-chrome-icon-only pw-chrome-icon-circle${q}`
        })
      } else {
        next += ' class="pw-chrome-icon-only pw-chrome-icon-circle"'
      }
    }
    const existing = next.match(/\bdata-pw-chrome-size=["'](\d+)["']/i)?.[1]
    const n = existing ? clampChromeFloatSize(existing) : fallback
    if (!existing) next += ` data-pw-chrome-size="${n}"`
    next = next.replace(/\sdata-pw-chrome-w=(["'])[^"']*\1/gi, '').replace(/\sdata-pw-chrome-h=(["'])[^"']*\1/gi, '')
    const styleMatch = next.match(/\sstyle=(["'])([\s\S]*?)\1/i)
    const quote = styleMatch?.[1] || '"'
    let css = String(styleMatch?.[2] || '')
      .replace(/(?:^|;)\s*--pw-chrome-(?:size|w|h)\s*:[^;]*/gi, '')
      .replace(/^;+|;+$/g, '')
      .trim()
    const sizeCss = `--pw-chrome-size:${n}px;--pw-chrome-w:${n}px;--pw-chrome-h:${n}px`
    const nextCss = css ? `${css};${sizeCss}` : sizeCss
    if (styleMatch) next = next.replace(/\sstyle=(["'])([\s\S]*?)\1/i, ` style=${quote}${nextCss}${quote}`)
    else next += ` style=${quote}${nextCss}${quote}`
    return `<${tag}${next}>`
  })
}

function writeHostCssVar(
  openAttrs: string,
  attrName: string,
  cssVar: string,
  n: number
): string {
  const styleMatch = openAttrs.match(/\sstyle=(["'])([\s\S]*?)\1/i)
  const quote = styleMatch?.[1] || '"'
  let css = String(styleMatch?.[2] || '')
    .replace(new RegExp(`(?:^|;)\\s*${cssVar}\\s*:[^;]*`, 'gi'), '')
    .replace(/^;+|;+$/g, '')
    .trim()
  let next = openAttrs.replace(new RegExp(`\\s${attrName}=(["'])[^"']*\\1`, 'i'), '')
  next += ` ${attrName}="${n}"`
  const nextCss = css ? `${css};${cssVar}:${n}px` : `${cssVar}:${n}px`
  if (styleMatch) return next.replace(/\sstyle=(["'])([\s\S]*?)\1/i, ` style=${quote}${nextCss}${quote}`)
  return `${next} style=${quote}${nextCss}${quote}`
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

/** Gắn `--pw-kit-gap` từ `data-pw-kit-gap` — 0 vẫn ghi (khác lệch ngang). Không invent nếu HTML chưa có. */
function withHostKitGapStyle(openAttrs: string): string {
  const fromAttr = openAttrs.match(new RegExp(`\\b${PW_KIT_GAP_ATTR}=(["'])([^"']*)\\1`, 'i'))?.[2]
  const fromCss = openAttrs.match(/--pw-kit-gap\s*:\s*(-?\d+(?:\.\d+)?)px/i)?.[1]
  if (fromAttr == null && fromCss == null) return openAttrs
  return writeHostCssVar(openAttrs, PW_KIT_GAP_ATTR, '--pw-kit-gap', clampChromeKitGap(fromAttr ?? fromCss))
}

const CHROME_BTN_BLOCK_RE =
  /<(a|button)\b[^>]*\bdata-pw-chrome-btn=["'][^"']+["'][^>]*>[\s\S]*?<\/\1>/gi

function chromeBtnKindOf(block: string): string {
  return block.match(/\bdata-pw-chrome-btn=["']([^"']+)["']/i)?.[1] || ''
}

function stampPdpCtaLockAttrs(html: string): string {
  return html.replace(/<(button|a)(\s[^>]*data-pw-chrome-btn=["'](?:add-cart|buy-now)["'][^>]*)>/gi, (_full, tag: string, attrs: string) => {
    let next = String(attrs)
      .replace(/\sdata-pw-hidden=(["'])[^"']*\1/gi, '')
      .replace(new RegExp(`\\s${PW_DOCK_SHOW_ATTR}=(["'])[^"']*\\1`, 'gi'), '')
    if (!new RegExp(`\\b${PW_KIT_LOCK_ATTR}=`, 'i').test(next)) next += ` ${PW_KIT_LOCK_ATTR}="cta"`
    next += ` ${PW_DOCK_SHOW_ATTR}="pdp"`
    return `<${tag}${next}>`
  })
}

function shopHomeAttrs(attrs: string): string {
  let next = attrs.replace(new RegExp(`\\s${PW_DOCK_SHOW_ATTR}=(["'])[^"']*\\1`, 'gi'), '')
  next += ` ${PW_DOCK_SHOW_ATTR}="shop"`
  return next
}

function extractBalancedDivByClass(
  html: string,
  className: string
): { full: string; inner: string; open: string; start: number } | null {
  const openRe = new RegExp(`<div\\b[^>]*\\b${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^>]*>`, 'i')
  const found = html.match(openRe)
  if (!found || found.index == null) return null
  return extractBalancedTag(html, 'div', found.index)
}

/** Một Home shop sibling. Home PDP trong `.pw-pdp-sticky-nav` giữ nguyên. */
function stripDuplicateShopDockHomes(inner: string): string {
  const navHit = extractBalancedDivByClass(inner, 'pw-pdp-sticky-nav')
  const ctaHit = extractBalancedDivByClass(inner, 'pw-pdp-sticky-ctas')
  const reserved: Array<{ start: number; end: number }> = []
  if (navHit) reserved.push({ start: navHit.start, end: navHit.start + navHit.full.length })
  if (ctaHit) reserved.push({ start: ctaHit.start, end: ctaHit.start + ctaHit.full.length })
  let seen = false
  CHROME_BTN_BLOCK_RE.lastIndex = 0
  return inner.replace(CHROME_BTN_BLOCK_RE, (block, _tag: string, offset: number) => {
    const inReserved = reserved.some((r) => offset >= r.start && offset < r.end)
    if (inReserved) return block
    if (chromeBtnKindOf(block) !== 'home') return block
    const open = block.match(/<[^>]+>/)?.[0] || ''
    if (isPdpOnlyDockOpenTag(open)) return block
    if (seen) return ''
    seen = true
    return block
  })
}

function revealPdpDefaultIcon(block: string, kind: string): string {
  return block.replace(/<(a|button)(\s[^>]*)>/i, (_m, tag: string, attrs: string) => {
    let next = String(attrs)
      .replace(new RegExp(`\\s${PW_HIDDEN_ATTR}=(["'])[^"']*\\1`, 'gi'), '')
      .replace(new RegExp(`\\s${PW_DOCK_SHOW_ATTR}=(["'])[^"']*\\1`, 'gi'), '')
    if (!new RegExp(`\\b${PW_PDP_NAV_ATTR}=`, 'i').test(next)) next += ` ${PW_PDP_NAV_ATTR}="1"`
    if (kind === 'home' && !new RegExp(`\\b${PW_PDP_HOME_ATTR}=`, 'i').test(next)) next += ` ${PW_PDP_HOME_ATTR}="1"`
    next += ` ${PW_DOCK_SHOW_ATTR}="pdp"`
    return `<${tag}${next}>`
  })
}

function isBuyBoxActionBlock(block: string): boolean {
  if (/\bpw-shop-btn-outline\b/.test(block)) return true
  if (/\bdata-pw-kit-lock=["']cta["']/.test(block)) return false
  if (/\bis-try\b|\bis-fav\b/.test(block)) return false
  if (new RegExp(`\\b${PW_PDP_NAV_ATTR}=`, 'i').test(block) || new RegExp(`\\b${PW_PDP_HOME_ATTR}=`, 'i').test(block)) {
    return false
  }
  return (
    /\bdata-pw-chrome-btn=["'](?:add-cart|buy-now)["']/.test(block) &&
    /\bpw-shop-btn\b/.test(block) &&
    !/\bdata-pw-chrome-kit=["']1["']/.test(block)
  )
}

function isPreferredPdpNavBlock(block: string): boolean {
  if (isBuyBoxActionBlock(block)) return false
  return (
    /\bis-try\b|\bis-fav\b/.test(block) ||
    new RegExp(`\\b${PW_PDP_NAV_ATTR}=`, 'i').test(block) ||
    new RegExp(`\\b${PW_PDP_HOME_ATTR}=`, 'i').test(block) ||
    /\bdata-pw-kit-lock=["']cta["']/.test(block)
  )
}

function rebuildPdpStickyNavInner(navInner: string, locale: WebLocale, siteSlug?: string | null): string {
  const blocks: string[] = []
  CHROME_BTN_BLOCK_RE.lastIndex = 0
  navInner.replace(CHROME_BTN_BLOCK_RE, (block) => {
    blocks.push(block)
    return ''
  })
  const defaults: Partial<Record<string, string>> = {}
  const extraExisting: Record<string, string> = {}
  for (const block of blocks) {
    const kind = chromeBtnKindOf(block)
    if (isBuyBoxActionBlock(block)) continue
    if (CHROME_KIT_PDP_NAV_DEFAULT_KINDS.includes(kind as (typeof CHROME_KIT_PDP_NAV_DEFAULT_KINDS)[number])) {
      if (!defaults[kind] || (isPreferredPdpNavBlock(block) && !isPreferredPdpNavBlock(defaults[kind] || ''))) {
        defaults[kind] = revealPdpDefaultIcon(block, kind)
      }
      continue
    }
    if (kind === 'add-cart' || kind === 'buy-now') continue
    if (kind && !extraExisting[kind]) extraExisting[kind] = block
  }
  const defaultHtml = CHROME_KIT_PDP_NAV_DEFAULT_KINDS.map(
    (kind) => defaults[kind] || buildDockPdpExtraIconHtml(kind, { locale, siteSlug })
  )
  return `${defaultHtml.join('\n      ')}\n      ${buildDockPdpNavExtrasHtml({
    locale,
    siteSlug,
    existing: extraExisting,
  })}`
}

function rebuildPdpStickyCtasInner(ctaInner: string, locale: WebLocale): string {
  const blocks: string[] = []
  CHROME_BTN_BLOCK_RE.lastIndex = 0
  ctaInner.replace(CHROME_BTN_BLOCK_RE, (block) => {
    blocks.push(block)
    return ''
  })
  let add = ''
  let buy = ''
  for (const block of blocks) {
    const kind = chromeBtnKindOf(block)
    if (isBuyBoxActionBlock(block)) continue
    if (kind === 'add-cart' && !add) add = stampPdpCtaLockAttrs(block)
    if (kind === 'buy-now' && !buy) buy = stampPdpCtaLockAttrs(block)
  }
  return `${add || buildDockPdpCtaHtml('add-cart', locale)}\n      ${buy || buildDockPdpCtaHtml('buy-now', locale)}`
}

export function ensurePdpDockFaceInInner(
  inner: string,
  locale: WebLocale,
  siteSlug?: string | null
): string {
  const stamped = stampPdpCtaLockAttrs(inner)
  const navHit = extractBalancedDivByClass(stamped, 'pw-pdp-sticky-nav')
  const ctaHit = extractBalancedDivByClass(stamped, 'pw-pdp-sticky-ctas')
  if (navHit && ctaHit) {
    const rebuiltNav = `${navHit.open}\n      ${rebuildPdpStickyNavInner(navHit.inner, locale, siteSlug)}\n    </div>`
    let next = stamped.replace(navHit.full, rebuiltNav)
    const cta2 = extractBalancedDivByClass(next, 'pw-pdp-sticky-ctas')
    if (cta2) {
      next = next.replace(
        cta2.full,
        `${cta2.open}\n      ${rebuildPdpStickyCtasInner(cta2.inner, locale)}\n    </div>`
      )
    }
    next = next.replace(
      /<(a|button)(\s[^>]*data-pw-chrome-btn=["']home["'][^>]*)>/gi,
      (full, tag: string, attrs: string) => {
        if (new RegExp(`\\b${PW_PDP_HOME_ATTR}=`, 'i').test(attrs)) return full
        if (new RegExp(`\\b${PW_PDP_NAV_ATTR}=`, 'i').test(attrs)) return full
        if (new RegExp(`\\b${PW_DOCK_SHOW_ATTR}=["']pdp["']`, 'i').test(attrs)) return full
        return `<${tag}${shopHomeAttrs(attrs)}>`
      }
    )
    if (!htmlHasShopDockKind(next, 'home')) {
      const shopHome = buildChromeKitShopDockItemHtml(
        { kind: 'home', slot: 'icon', defaultShow: 'shop' },
        { locale, siteSlug }
      )
      if (shopHome) next = `${shopHome}\n    ${next}`
    }
    return stripDuplicateShopDockHomes(next)
  }

  const blocks: string[] = []
  CHROME_BTN_BLOCK_RE.lastIndex = 0
  const leftover = stamped
    .replace(CHROME_BTN_BLOCK_RE, (block) => {
      blocks.push(block)
      return ''
    })
    .replace(/<div\b[^>]*\b(?:pw-pdp-sticky-nav|pw-pdp-sticky-ctas)\b[^>]*>\s*<\/div>/gi, '')
    .trim()

  const shop: string[] = []
  const extras: Record<string, string> = {}
  let pdpHome = ''
  let pdpTry = ''
  let pdpFav = ''
  let pdpAdd = ''
  let pdpBuy = ''
  for (const block of blocks) {
    const kind = chromeBtnKindOf(block)
    const isPdpHome = new RegExp(`\\b${PW_PDP_HOME_ATTR}=`, 'i').test(block)
    const isPdpNav = new RegExp(`\\b${PW_PDP_NAV_ATTR}=`, 'i').test(block) || /\bdata-pw-dock-show=["']pdp["']/i.test(block)
    if (kind === 'home' && (isPdpHome || /\bdata-pw-dock-show=["']pdp["']/i.test(block))) {
      pdpHome = block
      continue
    }
    if (kind === 'try-on') {
      if (!isBuyBoxActionBlock(block) && (!pdpTry || isPreferredPdpNavBlock(block))) pdpTry = block
      continue
    }
    if (kind === 'favorite-product') {
      if (!isBuyBoxActionBlock(block) && (!pdpFav || isPreferredPdpNavBlock(block))) pdpFav = block
      continue
    }
    if (kind === 'add-cart') {
      if (!isBuyBoxActionBlock(block)) pdpAdd = stampPdpCtaLockAttrs(block)
      continue
    }
    if (kind === 'buy-now') {
      if (!isBuyBoxActionBlock(block)) pdpBuy = stampPdpCtaLockAttrs(block)
      continue
    }
    if (kind === 'home') {
      if (!shop.some((existing) => chromeBtnKindOf(existing) === 'home')) {
        shop.push(block.replace(/<(a|button)(\s[^>]*)>/i, (_m, tag: string, attrs: string) => `<${tag}${shopHomeAttrs(attrs)}>`))
      }
      continue
    }
    if (isPdpNav && isPdpDockNavKind(kind) && !extras[kind]) {
      extras[kind] = block
      continue
    }
    shop.push(block)
  }

  const face = buildDockPdpFaceHtml({
    locale,
    siteSlug,
    nav: { home: pdpHome || undefined, tryOn: pdpTry || undefined, favorite: pdpFav || undefined },
    extras,
    ctas: { addCart: pdpAdd || undefined, buyNow: pdpBuy || undefined },
  })
  if (!shop.some((block) => chromeBtnKindOf(block) === 'home')) {
    const shopHome = buildChromeKitShopDockItemHtml(
      { kind: 'home', slot: 'icon', defaultShow: 'shop' },
      { locale, siteSlug }
    )
    if (shopHome) shop.unshift(shopHome)
  }
  return stripDuplicateShopDockHomes(
    `${shop.join('\n    ')}${leftover ? `\n    ${leftover}` : ''}\n    ${face}`
  )
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
    return `<div${withHostKitGapStyle(withHostKitShiftStyle(withHostKitAttr(attrs, 'actions')))}>${nextInner}</div>`
  })

  out = replaceBalancedBottomNavs(out, (attrs, inner, full) => {
    if (isLeftoverPdpBarAttrs(attrs)) return full
    let nextInner = stampExistingKitAttrs(inner, 'dock')
    const missing = CHROME_KIT_DOCK_ITEMS.filter((item) => {
      if (item.kind === 'try-on' || item.kind === 'favorite-product' || isPdpDockCtaLocked(item.kind)) {
        return false
      }
      return !htmlHasShopDockKind(nextInner, item.kind)
    })
    if (missing.length) {
      const extras = missing
        .map((item) =>
          buildChromeKitShopDockItemHtml(item, {
            locale,
            siteSlug: input.siteSlug,
            logoUrl: input.logoUrl,
            chatIconLogoUrl: input.chatIconLogoUrl,
            device: input.device,
          })
        )
        .filter(Boolean)
      const homeExtra = extras.filter((block) => chromeBtnKindOf(block) === 'home').join('\n    ')
      const restExtra = extras.filter((block) => chromeBtnKindOf(block) !== 'home').join('\n    ')
      nextInner = [homeExtra, nextInner.trim(), restExtra].filter(Boolean).join('\n    ')
    }
    nextInner = ensurePdpDockFaceInInner(nextInner, locale, input.siteSlug)
    return `<nav${withHostKitAttr(attrs, 'dock')}>${nextInner}</nav>`
  })

  const hasKitDock = new RegExp(`${PW_CHROME_KIT_ATTR}=["']dock["']`, 'i').test(out)
  PDP_BOTTOM_NAV_RE.lastIndex = 0
  if (hasKitDock) {
    out = out.replace(PDP_BOTTOM_NAV_RE, (block) => (keepPdpBarBlock(block) ? block : ''))
  } else if (/data-pw-pdp-bottom=/i.test(out) || /["'\s]pw-pdp-sticky["'\s]/.test(out)) {
    const dock = `<nav class="pw-bottom-nav pw-shop-bottom-nav" data-pw-region="nav" ${PW_CHROME_KIT_ATTR}="dock">\n    ${buildChromeKitDockHtml({
      locale,
      siteSlug: input.siteSlug,
      logoUrl: input.logoUrl,
      chatIconLogoUrl: input.chatIconLogoUrl,
      device: input.device,
    })}\n  </nav>`
    let replaced = false
    PDP_BOTTOM_NAV_RE.lastIndex = 0
    out = out.replace(PDP_BOTTOM_NAV_RE, (block) => {
      if (keepPdpBarBlock(block)) return block
      if (replaced) return ''
      replaced = true
      return dock
    })
  }

  out = ensureChromeKitFloatHost(out, {
    locale,
    siteSlug: input.siteSlug,
    logoUrl: input.logoUrl,
    chatIconLogoUrl: input.chatIconLogoUrl,
    device: input.device,
  })

  return stripAuthorPinScreenInHtml(
    pinMidCanvasTopChromeInHtml(
      stripEscapedHeadChromeLeftoversInHtml(stripLeftoverPdpFaceOutsideDock(hoistViewportDockToBody(out)))
    )
  )
}

const FLOAT_KIT_HOST_RE =
  /<(aside|div|nav)([^>]*\bdata-pw-chrome-kit=["']float["'][^>]*)>([\s\S]*?)<\/\1>/i
const STANDALONE_FLOAT_RE = new RegExp(
  `<(a|button)\\b([^>]*\\bdata-pw-chrome-btn=["'](?:${PW_CHROME_FLOAT_KINDS.join('|')})["'][^>]*)>([\\s\\S]*?)<\\/\\1>`,
  'gi'
)

function insideOpenTag(html: string, index: number, tag: string): boolean {
  const before = html.slice(0, index).toLowerCase()
  return before.lastIndexOf(`<${tag}`) > before.lastIndexOf(`</${tag}`)
}

/** Body-level kit icons after runtime hoist — keep authored face/colors, do not reseed. */
function takeEscapedChromeFloatWidgets(html: string): { html: string; widgets: Map<string, string> } {
  const widgets = new Map<string, string>()
  const ranges: Array<{ start: number; end: number }> = []
  const scan = new RegExp(STANDALONE_FLOAT_RE.source, STANDALONE_FLOAT_RE.flags)
  let found: RegExpExecArray | null
  while ((found = scan.exec(html))) {
    const start = found.index
    const full = found[0]
    const attrs = found[2] || ''
    if (/\bdata-pw-chrome-kit=["'](?:actions|dock|float)["']/i.test(attrs)) continue
    if (insideOpenTag(html, start, 'header') || insideOpenTag(html, start, 'footer')) continue
    if (insideOpenTag(html, start, 'nav') || insideOpenTag(html, start, 'aside')) continue
    const kind = attrs.match(/\bdata-pw-chrome-btn=["']([^"']+)["']/i)?.[1] || ''
    if (!FLOAT_KIND_SET.has(kind as PwChromeFloatKind) || widgets.has(kind)) continue
    const isFloat = /\bdata-pw-chrome-float=["']1["']/i.test(attrs)
    const isKitBtn = /\bdata-pw-chrome-kit=["']1["']/i.test(attrs)
    if (isKitBtn && !isFloat) continue
    widgets.set(kind, asFloatKitTag(full, ''))
    ranges.push({ start, end: start + full.length })
  }
  let next = html
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    next = next.slice(0, ranges[i].start) + next.slice(ranges[i].end)
  }
  return { html: next, widgets }
}

function ensureChromeKitFloatHost(
  html: string,
  input: {
    locale: WebLocale
    siteSlug?: string | null
    logoUrl?: string | null
    chatIconLogoUrl?: string | null
    device?: VisualDeviceVariant | null
  }
): string {
  const escaped = takeEscapedChromeFloatWidgets(html)
  const hostMatch = escaped.html.match(FLOAT_KIT_HOST_RE)
  if (hostMatch) {
    const migrateCircle = !new RegExp(`\\b${PW_FLOAT_SIZE_ATTR}=`, 'i').test(hostMatch[2])
    let inner = stampExistingKitAttrs(hostMatch[3], 'float')
    for (const [kind, snippet] of escaped.widgets) {
      if (!htmlHasChromeKind(inner, kind)) inner = `${inner.trim()}\n    ${snippet}\n  `
    }
    if (migrateCircle && !new RegExp(`\\b${PW_FLOAT_SIZE_ATTR}=`, 'i').test(hostMatch[2])) {
      const fromChild = inner.match(/\bdata-pw-chrome-size=["'](\d+)["']/i)?.[1]
      if (fromChild && !/\bdata-pw-float-size=/i.test(hostMatch[2])) {
        hostMatch[2] += ` ${PW_FLOAT_SIZE_ATTR}="${clampChromeFloatSize(fromChild)}"`
      }
    }
    const missing = CHROME_KIT_FLOAT_ITEMS.filter((item) => !htmlHasChromeKind(inner, item.kind))
    if (missing.length) {
      const extra = buildChromeKitFloatHtml(input)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => {
          const kind = line.match(/data-pw-chrome-btn=["']([^"']+)["']/)?.[1]
          return kind && missing.some((item) => item.kind === kind)
        })
        .join('\n    ')
      if (extra) inner = `${inner.trim()}\n    ${extra}\n  `
    }
    const hostAttrs = withFloatStackHostAttrs(withHostKitAttr(hostMatch[2], 'float'), input.device)
    const size = floatHostSizeFromAttrs(hostAttrs)
    inner = stampFloatKitFaceAndSize(inner, size, migrateCircle)
    const nextHost = `<${hostMatch[1]}${hostAttrs}>${inner}</${hostMatch[1]}>`
    return escaped.html.replace(FLOAT_KIT_HOST_RE, nextHost)
  }

  const kept = [...escaped.widgets.values()]
  const seen = new Set(escaped.widgets.keys())
  let stripped = escaped.html

  const missing = CHROME_KIT_FLOAT_ITEMS.filter((item) => !seen.has(item.kind))
  const extra = missing.length
    ? buildChromeKitFloatHtml(input)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => {
          const kind = line.match(/data-pw-chrome-btn=["']([^"']+)["']/)?.[1]
          return kind && missing.some((item) => item.kind === kind)
        })
    : []
  const seedSize = chromeFloatRhythmForDevice(input.device).size
  const inner = stampFloatKitFaceAndSize([...kept, ...extra].filter(Boolean).join('\n    '), seedSize, true)
  const host = buildChromeKitFloatHostHtml({ ...input, inner })
  if (/<\/body>/i.test(stripped)) return stripped.replace(/<\/body>/i, `${host}\n</body>`)
  return `${stripped}\n${host}`
}

const MID_FLOW_CHROME_OPEN_RE =
  /<(a|button)\b(?=[^>]*\bdata-pw-chrome-added=["']1["'])(?=[^>]*\bdata-pw-chrome-btn=)[^>]*>/gi

function stampMidTopOpenTag(openTag: string): string {
  let next = openTag
    .replace(/\sdata-pw-pin-screen=(["'])[^"']*\1/gi, '')
    .replace(/\sdata-pw-stay-scroll=(["'])[^"']*\1/gi, '')
    .replace(/\sdata-pw-stay-[xy]=(["'])[^"']*\1/gi, '')
    .replace(/\sdata-pw-stick-header=(["'])[^"']*\1/gi, '')
    .replace(/\sdata-pw-device=(["'])[^"']*\1/gi, '')
    .replace(/\sdata-pw-scene=(["'])[^"']*\1/gi, '')
    .replace(/\sdata-pw-z=(["'])[^"']*\1/gi, '')
  if (!/\bdata-pw-scene=/.test(next)) {
    next = next.replace(/>$/, ` data-pw-scene="${PW_MID_CANVAS_TOP_SCENE}" data-pw-z="${pwSceneZ(PW_MID_CANVAS_TOP_SCENE)}">`)
  }
  return next
}

function unwrapAddedChromeSlots(html: string): string {
  return html.replace(/<div\b[^>]*\bdata-pw-added-chrome-slot=["']1["'][^>]*>([\s\S]*?)<\/div>/gi, '$1')
}

/** Gỡ leftover «Nổi trên màn hình». Thanh nổi kit (`data-pw-chrome-float`) giữ nguyên. */
export function stripAuthorPinScreenInHtml(html: string): string {
  if (!html.trim() || !/data-pw-pin-screen=/i.test(html)) return html
  return html.replace(/<([a-zA-Z][\w:-]*)(\s[^>]*?)>/g, (full, tag: string, attrs: string) => {
    if (!/\bdata-pw-pin-screen=/i.test(attrs)) return full
    if (/\bdata-pw-chrome-float=["']1["']/i.test(attrs)) return full
    if (/\bdata-pw-chrome-kit=["']float["']/i.test(attrs)) return full
    let next = attrs.replace(/\sdata-pw-pin-screen=(["'])[^"']*\1/gi, '')
    if (!/\bdata-pw-stay-scroll=["']1["']/i.test(next)) {
      next = next
        .replace(/\sdata-pw-placement=(["'])viewport-fixed\1/gi, '')
        .replace(/\sdata-pw-fixed-[xywh]=(["'])[^"']*\1/gi, '')
        .replace(/\sdata-pw-fixed-anchor=(["'])[^"']*\1/gi, '')
    }
    return `<${tag}${next}>`
  })
}

/** Nút giữa trang luôn lớp nổi; giữ tọa độ. File máy nào = máy đó — không ẩn theo viewport. */
export function pinMidCanvasTopChromeInHtml(html: string): string {
  if (!html.trim() || !/data-pw-chrome-added=["']1["']/i.test(html)) return html
  MID_FLOW_CHROME_OPEN_RE.lastIndex = 0
  const matches: Array<{ start: number; endOpen: number; open: string }> = []
  let found: RegExpExecArray | null
  while ((found = MID_FLOW_CHROME_OPEN_RE.exec(html))) {
    const start = found.index
    const attrs = found[0]
    const kind = attrs.match(/\bdata-pw-chrome-btn=["']([^"']+)["']/i)?.[1] || ''
    if (!isMidCanvasFlowChromeKind(kind)) continue
    if (/\bdata-pw-chrome-kit=/.test(attrs) || /\bdata-pw-chrome-float=["']1["']/.test(attrs)) continue
    if (insideOpenTag(html, start, 'header') || insideOpenTag(html, start, 'footer')) continue
    if (insideOpenTag(html, start, 'nav') || insideOpenTag(html, start, 'aside')) continue
    matches.push({ start, endOpen: start + attrs.length, open: attrs })
  }
  let out = html
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const item = matches[i]
    out = out.slice(0, item.start) + stampMidTopOpenTag(item.open) + out.slice(item.endOpen)
  }
  return unwrapAddedChromeSlots(out)
}

export function reseatMidCanvasFlowChromeInHtml(html: string): string {
  return pinMidCanvasTopChromeInHtml(html)
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pdpHomeSvg(): string {
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`
}

function pdpTryOnSvg(): string {
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>`
}

function pdpHeartSvg(): string {
  return `<svg class="pw-pdp-like-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`
}
