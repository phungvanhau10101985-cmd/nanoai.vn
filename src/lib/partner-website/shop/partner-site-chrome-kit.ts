/**
 * Kit chrome sẵn: head / thanh đáy / thanh nổi — ẩn hiện + thứ tự, không tọa độ.
 * Nút Thêm giữa trang (Cửa hàng / Ví quà…) — kéo tọa độ, luôn lớp nổi, mỗi máy một file.
 * Mỗi máy một bản (Desktop ≠ Laptop ≠ Tablet ≠ Mobile).
 */
import type { WebLocale } from '@/lib/i18n/config'
import { PW_HIDDEN_ATTR } from '@/lib/partner-website/shop/stay-scroll-elements'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteHomePath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  clampChromeFloatSize,
  PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX,
  PW_CHROME_FLOAT_DEFAULT_RIGHT_PX,
  PW_CHROME_FLOAT_KINDS,
  PW_FLOAT_GAP_ATTR,
  PW_FLOAT_GAP_DEFAULT,
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
/** Desktop/Laptop hiện đang `gap:2px`. Mobile/Tablet compact đang `gap:0`. */
export const PW_KIT_GAP_DEFAULT = 2
export const PW_KIT_GAP_DEFAULT_COMPACT = 0

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

export function chromeKitHeadGroup(device?: VisualDeviceVariant | null): ChromeKitHeadGroup {
  if (device === 'laptop' || device === 'tablet' || device === 'mobile') return device
  return 'desktop'
}

export function chromeKitGapDefaultForDevice(device?: VisualDeviceVariant | null): number {
  const group = chromeKitHeadGroup(device)
  return group === 'mobile' || group === 'tablet' ? PW_KIT_GAP_DEFAULT_COMPACT : PW_KIT_GAP_DEFAULT
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
  return CHROME_KIT_HEAD_ACTION_ITEMS.map((item) => {
    const raw = buildVisualEditorChromeWidgetHtml({
      kind: item.kind,
      siteSlug: slug,
      locale: input.locale,
      style: chromeKitHeadStyle(group),
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

function dockPdpTwoLine(line1: string, line2?: string): string {
  const a = escapeText(line1)
  const b = (line2 || '').trim()
  if (!b) return `<span class="pw-pdp-sticky-copy"><span>${a}</span></span>`
  return `<span class="pw-pdp-sticky-copy"><span>${a}</span><span>${escapeText(b)}</span></span>`
}

function buildDockPdpHomeHtml(locale: WebLocale, siteSlug?: string | null): string {
  const t = getPartnerSiteShopCopy(locale)
  const href = partnerSiteHomePath(slugOrShop(siteSlug))
  return `<a href="${href}" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="home" ${pwElAttr(PW_EL.navLink)} ${PW_DOCK_SLOT_ATTR}="icon" ${PW_DOCK_SHOW_ATTR}="pdp" ${PW_PDP_HOME_ATTR}="1" aria-label="${escapeText(t.pdpStickyHome)}">${pdpHomeSvg()}${dockPdpTwoLine(t.pdpStickyHomeL1, t.pdpStickyHomeL2)}</a>`
}

function buildDockPdpFavoriteHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return `<button type="button" class="is-fav" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="favorite-product" ${pwElAttr(PW_EL.wishlist)} ${PW_DOCK_SLOT_ATTR}="icon" ${PW_DOCK_SHOW_ATTR}="pdp" data-pw-favorite data-pw-pdp-favorite="1" data-pw-like-base="0" aria-pressed="false">${pdpHeartSvg()}<span class="pw-pdp-like-copy"><span>${escapeText(t.pdpStickyLikeLabel)}</span><span class="pw-pdp-like-count" data-pw-like-count>0</span></span></button>`
}

function buildDockPdpTryOnHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return `<button type="button" class="is-try" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="try-on" ${PW_DOCK_SLOT_ATTR}="icon" ${PW_DOCK_SHOW_ATTR}="pdp" data-nanoai-try-on>${pdpTryOnSvg()}${dockPdpTwoLine(t.pdpStickyTryOnL1, t.pdpStickyTryOnL2)}</button>`
}

function buildDockPdpCtaHtml(kind: 'add-cart' | 'buy-now', locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  if (kind === 'add-cart') {
    return `<button type="button" class="pw-shop-btn pw-shop-btn-cart" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="add-cart" ${pwElAttr(PW_EL.cardCart)} ${PW_DOCK_SLOT_ATTR}="cta" ${PW_DOCK_SHOW_ATTR}="pdp" ${PW_KIT_LOCK_ATTR}="cta" data-pw-add-cart data-pw-pdp-add-cart="1">${escapeText(t.pdpAddToCartShort)}</button>`
  }
  return `<button type="button" class="pw-shop-btn pw-shop-btn-buy" ${PW_CHROME_KIT_ATTR}="1" data-pw-chrome-btn="buy-now" ${pwElAttr(PW_EL.buy)} ${PW_DOCK_SLOT_ATTR}="cta" ${PW_DOCK_SHOW_ATTR}="pdp" ${PW_KIT_LOCK_ATTR}="cta" data-pw-buy data-pw-pdp-buy-now="1">${escapeText(t.pdpBuyNowShort)}</button>`
}

function buildDockPdpFaceHtml(input: {
  locale: WebLocale
  siteSlug?: string | null
  nav?: { home?: string; tryOn?: string; favorite?: string }
  ctas?: { addCart?: string; buyNow?: string }
}): string {
  const navHome = input.nav?.home || buildDockPdpHomeHtml(input.locale, input.siteSlug)
  const navTry = input.nav?.tryOn || buildDockPdpTryOnHtml(input.locale)
  const navFav = input.nav?.favorite || buildDockPdpFavoriteHtml(input.locale)
  const addCart = stampPdpCtaLockAttrs(input.ctas?.addCart || buildDockPdpCtaHtml('add-cart', input.locale))
  const buyNow = stampPdpCtaLockAttrs(input.ctas?.buyNow || buildDockPdpCtaHtml('buy-now', input.locale))
  return `<div class="pw-pdp-sticky-nav" ${PW_DOCK_SHOW_ATTR}="pdp">
      ${navHome}
      ${navTry}
      ${navFav}
    </div>
    <div class="pw-pdp-sticky-ctas" ${PW_DOCK_SHOW_ATTR}="pdp">
      ${addCart}
      ${buyNow}
    </div>`
}

export function buildChromeKitDockHtml(input: {
  locale: WebLocale
  siteSlug?: string | null
  logoUrl?: string | null
  chatIconLogoUrl?: string | null
}): string {
  const slug = slugOrShop(input.siteSlug)
  const shopItems = CHROME_KIT_DOCK_ITEMS.filter(
    (item) => item.kind !== 'try-on' && item.kind !== 'favorite-product' && item.kind !== 'add-cart' && item.kind !== 'buy-now'
  )
    .map((item) => {
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
  return `${shopItems}
    ${buildDockPdpFaceHtml({ locale: input.locale, siteSlug: input.siteSlug })}`
}

export function buildChromeKitFloatHtml(input: {
  locale: WebLocale
  siteSlug?: string | null
  logoUrl?: string | null
  chatIconLogoUrl?: string | null
}): string {
  const slug = slugOrShop(input.siteSlug)
  return CHROME_KIT_FLOAT_ITEMS.map((item) => {
    const raw = buildVisualEditorChromeWidgetHtml({
      kind: item.kind,
      siteSlug: slug,
      locale: input.locale,
      style: 'icon-circle',
      place: 'nav',
      logoUrl: input.logoUrl,
      chatIconLogoUrl: input.chatIconLogoUrl,
      iconSize: PW_FLOAT_SIZE_DEFAULT,
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
}): string {
  const inner = (input.inner || buildChromeKitFloatHtml(input)).trim()
  return `<aside class="pw-chrome-float-kit" ${PW_CHROME_KIT_ATTR}="float" data-pw-chrome-float-host="1" ${PW_FLOAT_RIGHT_ATTR}="${PW_CHROME_FLOAT_DEFAULT_RIGHT_PX}" ${PW_FLOAT_STACK_BOTTOM_ATTR}="${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.chat}" ${PW_FLOAT_GAP_ATTR}="${PW_FLOAT_GAP_DEFAULT}" ${PW_FLOAT_SIZE_ATTR}="${PW_FLOAT_SIZE_DEFAULT}" style="--pw-float-size:${PW_FLOAT_SIZE_DEFAULT}px">\n    ${inner}\n  </aside>`
}

export const PARTNER_SHOP_CHROME_KIT_CSS = `
.pw-header-actions[${PW_CHROME_KIT_ATTR}="actions"],.pw-shop-header-actions[${PW_CHROME_KIT_ATTR}="actions"]{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;margin-right:0!important;gap:var(--pw-kit-gap, 2px)!important;transform:translateX(var(--pw-kit-x, 0px))!important}
.pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"],.pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"]{flex-wrap:nowrap!important;align-items:stretch}
.pw-bottom-nav .pw-pdp-sticky-nav,.pw-shop-bottom-nav .pw-pdp-sticky-nav,.pw-bottom-nav .pw-pdp-sticky-ctas,.pw-shop-bottom-nav .pw-pdp-sticky-ctas,
.pw-bottom-nav [${PW_DOCK_SHOW_ATTR}="pdp"],.pw-shop-bottom-nav [${PW_DOCK_SHOW_ATTR}="pdp"]{display:none!important}
[data-pw-page="product"] .pw-bottom-nav [${PW_DOCK_SHOW_ATTR}="shop"],[data-pw-page="product"] .pw-shop-bottom-nav [${PW_DOCK_SHOW_ATTR}="shop"]{display:none!important}
[data-pw-page="product"] .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"],[data-pw-page="product"] .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"]{
  justify-content:flex-start!important;align-items:stretch!important;gap:6px!important;min-height:48px!important;
  padding:2px 6px calc(2px + env(safe-area-inset-bottom,0px))!important;background:#f3f4f6!important;border-top:1px solid #e5e7eb!important
}
[data-pw-page="product"] .pw-bottom-nav .pw-pdp-sticky-nav,[data-pw-page="product"] .pw-shop-bottom-nav .pw-pdp-sticky-nav{
  display:flex!important;align-items:stretch;gap:1px;flex:0 0 auto;padding-right:6px;margin-right:2px;border-right:1px solid #e5e7eb
}
[data-pw-page="product"] .pw-bottom-nav .pw-pdp-sticky-ctas,[data-pw-page="product"] .pw-shop-bottom-nav .pw-pdp-sticky-ctas{
  display:flex!important;flex:1;min-width:0;gap:4px
}
[data-pw-page="product"] .pw-bottom-nav .pw-pdp-sticky-nav [${PW_DOCK_SHOW_ATTR}="pdp"]:not([${PW_HIDDEN_ATTR}="1"]),[data-pw-page="product"] .pw-shop-bottom-nav .pw-pdp-sticky-nav [${PW_DOCK_SHOW_ATTR}="pdp"]:not([${PW_HIDDEN_ATTR}="1"]){
  display:flex!important;flex-direction:column;flex:0 0 44px!important;width:44px!important;gap:2px!important;padding:2px 0!important;font-size:10px!important;line-height:1.05!important;color:#4b5563!important;background:transparent!important
}
[data-pw-page="product"] .pw-bottom-nav .pw-pdp-sticky-ctas [${PW_DOCK_SHOW_ATTR}="pdp"],[data-pw-page="product"] .pw-shop-bottom-nav .pw-pdp-sticky-ctas [${PW_DOCK_SHOW_ATTR}="pdp"]{
  display:flex!important;flex:1 1 0!important;min-height:40px;align-items:center;justify-content:center;padding:0 8px!important;font-size:11px!important;font-weight:600!important;text-transform:uppercase;border-radius:6px!important;color:#fff!important
}
[data-pw-page="product"] .pw-bottom-nav .pw-pdp-sticky-nav svg,[data-pw-page="product"] .pw-shop-bottom-nav .pw-pdp-sticky-nav svg{width:17px!important;height:17px!important;max-width:17px!important;max-height:17px!important}
[data-pw-page="product"] .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] [data-pw-chrome-btn="add-cart"],[data-pw-page="product"] .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] [data-pw-chrome-btn="add-cart"]{background:var(--pw-cart)!important;color:#fff!important}
[data-pw-page="product"] .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] [data-pw-chrome-btn="buy-now"],[data-pw-page="product"] .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] [data-pw-chrome-btn="buy-now"]{background:var(--pw-buy)!important;color:#fff!important}
[data-pw-page="product"] .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] .is-try,[data-pw-page="product"] .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] .is-try{color:var(--pw-primary)!important}
[data-pw-page="product"] .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] .is-fav[aria-pressed="true"],[data-pw-page="product"] .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] .is-fav[aria-pressed="true"]{color:#e11d48!important}
[data-pw-page="product"] .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] .is-fav[aria-pressed="true"] svg,[data-pw-page="product"] .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] .is-fav[aria-pressed="true"] svg{fill:currentColor!important}
[data-pw-page="product"] .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] ~ .pw-bottom-nav[data-pw-pdp-bottom],[data-pw-page="product"] .pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"] ~ .pw-bottom-nav[data-pw-pdp-bottom],
[data-pw-page="product"] .pw-bottom-nav[data-pw-pdp-bottom] ~ .pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"]{display:none!important}
.pw-shop:has([${PW_CHROME_KIT_ATTR}="dock"]) .pw-pdp-sticky{display:none!important}
.pw-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"],.pw-shop-bottom-nav[${PW_CHROME_KIT_ATTR}="dock"]{
  justify-content:stretch!important;gap:0!important;min-height:56px!important;
  padding:4px 2px calc(4px + env(safe-area-inset-bottom,0px))!important;background:#fff!important;border-top:1px solid var(--pw-border,#e5e7eb)!important
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
const BOTTOM_NAV_RE =
  /<(nav)([^>]*class=["'][^"']*\b(?:pw-bottom-nav|pw-shop-bottom-nav)\b[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/i
const PDP_BOTTOM_NAV_RE =
  /<(nav)[^>]*(?:data-pw-pdp-bottom=["']1["']|class=["'][^"']*\bpw-pdp-sticky\b)[^>]*>[\s\S]*?<\/\1>/i

function htmlHasChromeKind(html: string, kind: string): boolean {
  const re = new RegExp(`data-pw-chrome-btn=["']${kind}["']`, 'i')
  return re.test(html)
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

function withFloatStackHostAttrs(openAttrs: string): string {
  let next = openAttrs
  if (!new RegExp(`\\b${PW_FLOAT_RIGHT_ATTR}=`, 'i').test(next)) {
    next += ` ${PW_FLOAT_RIGHT_ATTR}="${PW_CHROME_FLOAT_DEFAULT_RIGHT_PX}"`
  }
  if (!new RegExp(`\\b${PW_FLOAT_STACK_BOTTOM_ATTR}=`, 'i').test(next)) {
    next += ` ${PW_FLOAT_STACK_BOTTOM_ATTR}="${PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.chat}"`
  }
  if (!new RegExp(`\\b${PW_FLOAT_GAP_ATTR}=`, 'i').test(next)) {
    next += ` ${PW_FLOAT_GAP_ATTR}="${PW_FLOAT_GAP_DEFAULT}"`
  }
  const hadSize = new RegExp(`\\b${PW_FLOAT_SIZE_ATTR}=`, 'i').test(next)
  const fromAttr = next.match(new RegExp(`\\b${PW_FLOAT_SIZE_ATTR}=(["'])([^"']*)\\1`, 'i'))?.[2]
  const fromCss = next.match(/--pw-float-size\s*:\s*(-?\d+(?:\.\d+)?)px/i)?.[1]
  const size = clampChromeFloatSize(fromAttr ?? fromCss ?? PW_FLOAT_SIZE_DEFAULT)
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
  const n = clampChromeFloatSize(size)
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
    if (/\bdata-pw-chrome-size=/i.test(next)) {
      next = next.replace(/\sdata-pw-chrome-size=(["'])[^"']*\1/gi, ` data-pw-chrome-size="${n}"`)
    } else {
      next += ` data-pw-chrome-size="${n}"`
    }
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

export function ensurePdpDockFaceInInner(
  inner: string,
  locale: WebLocale,
  siteSlug?: string | null
): string {
  const stamped = stampPdpCtaLockAttrs(inner)
  if (/\bpw-pdp-sticky-nav\b/.test(stamped) && /\bpw-pdp-sticky-ctas\b/.test(stamped)) {
    let next = stamped
    if (!new RegExp(`\\b${PW_PDP_HOME_ATTR}=["']1["']`, 'i').test(next)) {
      next = next.replace(
        /(<div\b[^>]*\bpw-pdp-sticky-nav\b[^>]*>)/i,
        `$1\n      ${buildDockPdpHomeHtml(locale, siteSlug)}`
      )
    }
    return next.replace(
      /<(a|button)(\s[^>]*data-pw-chrome-btn=["']home["'][^>]*)>/gi,
      (full, tag: string, attrs: string) => {
        if (new RegExp(`\\b${PW_PDP_HOME_ATTR}=`, 'i').test(attrs)) return full
        if (new RegExp(`\\b${PW_DOCK_SHOW_ATTR}=["']pdp["']`, 'i').test(attrs)) return full
        return `<${tag}${shopHomeAttrs(attrs)}>`
      }
    )
  }

  const blocks: string[] = []
  const leftover = stamped
    .replace(CHROME_BTN_BLOCK_RE, (block) => {
      blocks.push(block)
      return ''
    })
    .replace(/<div\b[^>]*\b(?:pw-pdp-sticky-nav|pw-pdp-sticky-ctas)\b[^>]*>\s*<\/div>/gi, '')
    .trim()

  const shop: string[] = []
  let pdpHome = ''
  let pdpTry = ''
  let pdpFav = ''
  let pdpAdd = ''
  let pdpBuy = ''
  for (const block of blocks) {
    const kind = chromeBtnKindOf(block)
    const isPdpHome = new RegExp(`\\b${PW_PDP_HOME_ATTR}=`, 'i').test(block)
    if (kind === 'home' && (isPdpHome || /\bdata-pw-dock-show=["']pdp["']/i.test(block))) {
      pdpHome = block
      continue
    }
    if (kind === 'try-on') {
      pdpTry = block
      continue
    }
    if (kind === 'favorite-product') {
      pdpFav = block
      continue
    }
    if (kind === 'add-cart') {
      pdpAdd = stampPdpCtaLockAttrs(block)
      continue
    }
    if (kind === 'buy-now') {
      pdpBuy = stampPdpCtaLockAttrs(block)
      continue
    }
    if (kind === 'home') {
      shop.push(block.replace(/<(a|button)(\s[^>]*)>/i, (_m, tag: string, attrs: string) => `<${tag}${shopHomeAttrs(attrs)}>`))
      continue
    }
    shop.push(block)
  }

  const face = buildDockPdpFaceHtml({
    locale,
    siteSlug,
    nav: { home: pdpHome || undefined, tryOn: pdpTry || undefined, favorite: pdpFav || undefined },
    ctas: { addCart: pdpAdd || undefined, buyNow: pdpBuy || undefined },
  })
  return `${shop.join('\n    ')}${leftover ? `\n    ${leftover}` : ''}\n    ${face}`
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

  const kitDockAlready = new RegExp(`${PW_CHROME_KIT_ATTR}=["']dock["']`, 'i').test(out)
  out = out.replace(BOTTOM_NAV_RE, (full, _tag: string, attrs: string, inner: string) => {
    if (/data-pw-pdp-bottom=["']1["']/i.test(attrs) && kitDockAlready) return full
    if (/data-pw-pdp-bottom=["']1["']/i.test(attrs)) return full
    let nextInner = stampExistingKitAttrs(inner, 'dock')
    const missing = CHROME_KIT_DOCK_ITEMS.filter((item) => {
      if (item.kind === 'try-on' || item.kind === 'favorite-product' || isPdpDockCtaLocked(item.kind)) {
        return false
      }
      return !htmlHasChromeKind(nextInner, item.kind)
    })
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
    nextInner = ensurePdpDockFaceInInner(nextInner, locale, input.siteSlug)
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

  out = ensureChromeKitFloatHost(out, {
    locale,
    siteSlug: input.siteSlug,
    logoUrl: input.logoUrl,
    chatIconLogoUrl: input.chatIconLogoUrl,
  })

  return pinMidCanvasTopChromeInHtml(out)
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
    const hostAttrs = withFloatStackHostAttrs(withHostKitAttr(hostMatch[2], 'float'))
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
  const inner = stampFloatKitFaceAndSize([...kept, ...extra].filter(Boolean).join('\n    '), PW_FLOAT_SIZE_DEFAULT, true)
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
