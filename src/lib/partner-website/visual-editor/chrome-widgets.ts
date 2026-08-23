import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteCategoryNavLabels } from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  normalizeContactHttpUrl,
  normalizeContactPhone,
  partnerSiteTelHref,
  partnerSiteWhatsAppHref,
} from '@/lib/partner-website/shop/partner-site-contact-channels'
import { isChromeFloatKind } from '@/lib/partner-website/shop/chrome-float-widgets'
import { searchGlyphSvg } from '@/lib/partner-website/visual-editor/search-cluster-icons'
import {
  canPickChromeGlyph,
  chromeGlyphSvg,
  normalizeChromeGlyph,
} from '@/lib/partner-website/visual-editor/chrome-widget-icons'
import {
  partnerSiteAccountEditPath,
  partnerSiteAccountPath,
  partnerSiteAccountTabPath,
  partnerSiteLoginPath,
  partnerSiteAddressesPath,
  partnerSiteCartPath,
  partnerSiteHomePath,
  partnerSiteInfoPath,
  partnerSiteOrdersPath,
  partnerSiteOrderTrackingPath,
  partnerSiteProductsPath,
  partnerSiteRecentlyViewedPath,
  partnerSiteWishlistPath,
  partnerSiteLeadApiPath,
  partnerSitePromotionsValidateApiPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeHtml(value: string): string {
  return escapeAttr(value)
}

export const PW_CHROME_ICON_SIZE_DEFAULT = 22
export const PW_CHROME_ICON_SIZE_MIN = 16
export const PW_CHROME_ICON_SIZE_MAX = 200

export function clampPwChromeIconSize(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return PW_CHROME_ICON_SIZE_DEFAULT
  return Math.min(PW_CHROME_ICON_SIZE_MAX, Math.max(PW_CHROME_ICON_SIZE_MIN, n))
}

export const PW_CHROME_LABEL_SIZE_DEFAULT = 13
export const PW_CHROME_LABEL_SIZE_MIN = 10
export const PW_CHROME_LABEL_SIZE_MAX = 48

export function clampPwChromeLabelSize(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return PW_CHROME_LABEL_SIZE_DEFAULT
  return Math.min(PW_CHROME_LABEL_SIZE_MAX, Math.max(PW_CHROME_LABEL_SIZE_MIN, n))
}

export const PW_CHROME_GAP_DEFAULT = 6
export const PW_CHROME_GAP_MIN = 0
export const PW_CHROME_GAP_MAX = 32

export function clampPwChromeGap(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return PW_CHROME_GAP_DEFAULT
  return Math.min(PW_CHROME_GAP_MAX, Math.max(PW_CHROME_GAP_MIN, n))
}

export const PW_CHROME_RADIUS_DEFAULT = 0
export const PW_CHROME_RADIUS_MIN = 0
export const PW_CHROME_RADIUS_MAX = 40

export function clampPwChromeRadius(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return PW_CHROME_RADIUS_DEFAULT
  return Math.min(PW_CHROME_RADIUS_MAX, Math.max(PW_CHROME_RADIUS_MIN, n))
}

export const PW_IMAGE_RADIUS_MIN = 0
export const PW_IMAGE_RADIUS_MAX = 80
export const PW_IMAGE_RADIUS_DEFAULT = 8
export const PW_IMAGE_RADIUS_ROUNDED = 16

export function clampPwImageRadius(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return PW_IMAGE_RADIUS_DEFAULT
  return Math.min(PW_IMAGE_RADIUS_MAX, Math.max(PW_IMAGE_RADIUS_MIN, n))
}

export const PW_CHROME_COUNT_KINDS = [
  'cart',
  'wishlist',
  'favorites-link',
  'notifications',
  'recently-viewed',
] as const

export function chromeKindShowsCountBadge(kind?: string | null): boolean {
  const k = String(kind || '')
  return (
    k === 'cart' ||
    k === 'wishlist' ||
    k === 'favorites-link' ||
    k === 'notifications' ||
    k === 'recently-viewed'
  )
}

export function chromeLabelSizeFromIcon(icon: number): number {
  return clampPwChromeLabelSize(Math.round((clampPwChromeIconSize(icon) * 13) / 22))
}

export const PW_CHROME_W_VAR = 'var(--pw-chrome-w,var(--pw-chrome-size,22px))'
export const PW_CHROME_H_VAR = 'var(--pw-chrome-h,var(--pw-chrome-size,22px))'
export const PW_CHROME_BTN_MIN_H = '0'

/** Pad follows icon tokens. Label size is independent (`--pw-chrome-label`). */
export const PW_CHROME_TOKEN_VARS_CSS =
  '[data-pw-chrome-added],[data-pw-chrome-btn],[data-pw-el="cat-toggle"]{' +
  '--pw-chrome-size:22px;' +
  '--pw-chrome-w:var(--pw-chrome-size);' +
  '--pw-chrome-h:var(--pw-chrome-size);' +
  '--pw-chrome-label:13px;' +
  '--pw-chrome-pad-y:calc(var(--pw-chrome-h,var(--pw-chrome-size,22px))*4/22);' +
  '--pw-chrome-pad-x:calc(var(--pw-chrome-w,var(--pw-chrome-size,22px))*12/22);' +
  '--pw-chrome-gap:calc(var(--pw-chrome-w,var(--pw-chrome-size,22px))*6/22);' +
  '--pw-chrome-weight:inherit;' +
  '--pw-chrome-radius:0px;' +
  '--pw-chrome-hover:currentColor' +
  '}'

/** Camera in the search pill — stretch to form height so it shares the lens centerline. */
export const PW_SEARCH_IMAGE_IN_FORM_BTN_CSS =
  '.pw-search-form .pw-search-image-btn,.pw-search-form .pw-shop-search-image,.pw-shop-search-form .pw-search-image-btn,.pw-shop-search-form .pw-shop-search-image{flex:0 0 auto!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;align-self:stretch!important;width:calc(var(--pw-chrome-w,var(--pw-chrome-size,16px)) + 4px)!important;min-width:calc(var(--pw-chrome-w,var(--pw-chrome-size,16px)) + 4px)!important;max-width:calc(var(--pw-chrome-w,var(--pw-chrome-size,16px)) + 4px)!important;height:auto!important;min-height:100%!important;max-height:none!important;padding:0!important;margin:0!important;background:transparent!important;font-size:0!important;line-height:0!important;overflow:hidden;box-sizing:border-box!important;position:relative!important;top:auto!important;transform:none!important}'

export const PW_SEARCH_IMAGE_IN_FORM_WRAP_CSS =
  '.pw-search-form .pw-search-image-btn .pw-chrome-icon-wrap,.pw-search-form .pw-shop-search-image .pw-chrome-icon-wrap,.pw-shop-search-form .pw-search-image-btn .pw-chrome-icon-wrap,.pw-shop-search-form .pw-shop-search-image .pw-chrome-icon-wrap{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:var(--pw-chrome-w,var(--pw-chrome-size,16px))!important;height:var(--pw-chrome-h,var(--pw-chrome-size,16px))!important;padding:0!important;margin:0!important;flex:0 0 auto!important}'

/** Built-in header/bottom-nav/PDP icons use the same size/style/color engine as Thêm. */
export const PW_STOCK_CHROME_EDIT_CSS =
  '.pw-bottom-nav>a,.pw-shop-bottom-nav>a,.pw-bottom-nav>button,.pw-shop-bottom-nav>button,' +
  '.pw-pdp-sticky-nav a,.pw-pdp-sticky-nav button{' +
  '--pw-chrome-size:22px;--pw-chrome-w:var(--pw-chrome-size);--pw-chrome-h:var(--pw-chrome-size)}' +
  '.pw-bottom-nav svg,.pw-shop-bottom-nav svg,.pw-pdp-sticky svg,.pw-pdp-sticky-nav svg,' +
  '.pw-bottom-nav .pw-chrome-icon-wrap,.pw-shop-bottom-nav .pw-chrome-icon-wrap{' +
  'width:var(--pw-chrome-w,var(--pw-chrome-size,22px))!important;' +
  'height:var(--pw-chrome-h,var(--pw-chrome-size,22px))!important;' +
  'max-width:var(--pw-chrome-w,var(--pw-chrome-size,22px))!important;' +
  'max-height:var(--pw-chrome-h,var(--pw-chrome-size,22px))!important}' +
  '.pw-bottom-nav .pw-chrome-icon-wrap,.pw-shop-bottom-nav .pw-chrome-icon-wrap{' +
  'display:inline-flex!important;align-items:center!important;justify-content:center!important}' +
  '.pw-bottom-nav>a[data-pw-chrome-style="text"],.pw-shop-bottom-nav>a[data-pw-chrome-style="text"],' +
  '.pw-bottom-nav>button[data-pw-chrome-style="text"],.pw-shop-bottom-nav>button[data-pw-chrome-style="text"],' +
  '.pw-bottom-nav>a.pw-chrome-link,.pw-shop-bottom-nav>a.pw-chrome-link,' +
  '.pw-bottom-nav>button.pw-chrome-link,.pw-shop-bottom-nav>button.pw-chrome-link,' +
  '.pw-bottom-nav .pw-chrome-has-label,.pw-shop-bottom-nav .pw-chrome-has-label{' +
  'flex:0 0 auto!important;width:auto!important;height:auto!important;' +
  'min-width:0!important;min-height:0!important;' +
  'flex-direction:row!important;gap:var(--pw-chrome-gap,6px)!important;' +
  'padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,12px)!important}' +
  '.pw-bottom-nav .pw-chrome-label-below,.pw-shop-bottom-nav .pw-chrome-label-below,' +
  '.pw-bottom-nav [data-pw-chrome-style="icon-label-below"],.pw-shop-bottom-nav [data-pw-chrome-style="icon-label-below"]{' +
  'flex-direction:column!important;align-items:center!important;justify-content:center!important;' +
  'width:auto!important;height:auto!important;min-width:0!important;min-height:0!important;' +
  'padding:var(--pw-chrome-pad-y,4px) 6px!important}' +
  '.pw-bottom-nav .pw-chrome-icon-only,.pw-shop-bottom-nav .pw-chrome-icon-only{' +
  'flex:0 0 auto!important;width:auto!important;height:auto!important;' +
  'min-width:0!important;min-height:0!important;' +
  'padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,4px)!important;flex-direction:row!important}' +
  '.pw-bottom-nav .pw-chrome-icon-square,.pw-shop-bottom-nav .pw-chrome-icon-square{border-radius:10px!important}' +
  '.pw-bottom-nav>a[data-pw-btn-text],.pw-shop-bottom-nav>a[data-pw-btn-text],' +
  '.pw-bottom-nav>button[data-pw-btn-text],.pw-shop-bottom-nav>button[data-pw-btn-text],' +
  '.pw-bottom-nav>a[data-pw-icon-color],.pw-shop-bottom-nav>a[data-pw-icon-color],' +
  '.pw-bottom-nav>button[data-pw-icon-color],.pw-shop-bottom-nav>button[data-pw-icon-color]{color:inherit!important}'

/** Labeled / text chrome hugs icon + chữ — no forced empty width/height box. */
export const PW_CHROME_LABELED_MIN_W_CSS =
  '[data-pw-chrome-btn].pw-chrome-has-label,[data-pw-chrome-added].pw-chrome-has-label,' +
  '[data-pw-chrome-btn].pw-chrome-link,[data-pw-chrome-added].pw-chrome-link,' +
  '[data-pw-chrome-btn].pw-chrome-label-below,[data-pw-chrome-added].pw-chrome-label-below,' +
  '[data-pw-chrome-btn][data-pw-chrome-style="icon-label"],[data-pw-chrome-added][data-pw-chrome-style="icon-label"],' +
  '[data-pw-chrome-btn][data-pw-chrome-style="icon-label-below"],[data-pw-chrome-added][data-pw-chrome-style="icon-label-below"],' +
  '[data-pw-chrome-btn][data-pw-chrome-style="icon-label-left"],[data-pw-chrome-added][data-pw-chrome-style="icon-label-left"],' +
  '[data-pw-chrome-btn][data-pw-chrome-style="text"],[data-pw-chrome-added][data-pw-chrome-style="text"],' +
  '[data-pw-chrome-btn].pw-chrome-icon-only,[data-pw-chrome-added].pw-chrome-icon-only,' +
  '[data-pw-chrome-btn][data-pw-chrome-style="icon"],[data-pw-chrome-added][data-pw-chrome-style="icon"],' +
  '[data-pw-chrome-btn][data-pw-chrome-style="icon-square"],[data-pw-chrome-added][data-pw-chrome-style="icon-square"]{' +
  'width:auto!important;min-width:0!important;height:auto!important;min-height:0!important;box-sizing:border-box!important}' +
  '.pw-search-form [data-pw-chrome-btn],.pw-shop-search-form [data-pw-chrome-btn]{width:auto!important;min-width:0!important;height:auto!important;min-height:0!important}' +
  '.pw-chrome-label-below .pw-chrome-btn-label,.pw-chrome-label-below .pw-shop-nav-label,.pw-chrome-label-below .pw-shop-icon-label,' +
  '[data-pw-chrome-style="icon-label-below"] .pw-chrome-btn-label,[data-pw-chrome-style="icon-label-below"] .pw-shop-nav-label,' +
  '[data-pw-chrome-style="icon-label-below"] .pw-shop-icon-label,' +
  '.pw-chrome-has-label .pw-chrome-btn-label,.pw-chrome-has-label .pw-shop-nav-label,.pw-chrome-has-label .pw-shop-icon-label,' +
  '.pw-chrome-link .pw-chrome-btn-label,.pw-chrome-link .pw-shop-icon-label{' +
  'max-width:none!important;width:auto!important;font-size:var(--pw-chrome-label,13px)!important}'

/** Cỡ chữ — stock thanh đáy / PDP dùng .pw-shop-icon-label, không bị font-size:10px khóa. */
export const PW_CHROME_LABEL_FACE_CSS =
  '[data-pw-chrome-btn], [data-pw-chrome-added], [data-pw-el="cat-toggle"]{' +
  'font-size:var(--pw-chrome-label,13px)}' +
  '.pw-bottom-nav>a,.pw-shop-bottom-nav>a,.pw-bottom-nav .pw-icon-btn,.pw-shop-bottom-nav .pw-icon-btn,' +
  '.pw-bottom-nav .pw-shop-icon-btn,.pw-shop-bottom-nav .pw-shop-icon-btn,' +
  '.pw-pdp-sticky-nav a,.pw-pdp-sticky-nav button{' +
  'font-size:var(--pw-chrome-label,13px)!important}' +
  '[data-pw-chrome-btn] .pw-chrome-btn-label,[data-pw-chrome-added] .pw-chrome-btn-label,' +
  '[data-pw-chrome-btn] .pw-shop-nav-label,[data-pw-chrome-added] .pw-shop-nav-label,' +
  '[data-pw-chrome-btn] .pw-shop-icon-label,[data-pw-chrome-added] .pw-shop-icon-label,' +
  '[data-pw-chrome-btn] .pw-account-btn-label,[data-pw-chrome-added] .pw-account-btn-label,' +
  '[data-pw-el="cat-toggle"] .pw-chrome-btn-label,[data-pw-el="cat-toggle"] .pw-shop-nav-label,' +
  '.pw-bottom-nav .pw-shop-icon-label,.pw-shop-bottom-nav .pw-shop-icon-label,' +
  '.pw-bottom-nav .pw-chrome-btn-label,.pw-shop-bottom-nav .pw-chrome-btn-label,' +
  '.pw-bottom-nav .pw-shop-nav-label,.pw-shop-bottom-nav .pw-shop-nav-label,' +
  '.pw-pdp-sticky-nav .pw-shop-icon-label,.pw-pdp-sticky-nav .pw-chrome-btn-label,' +
  '.pw-pdp-sticky-nav .pw-shop-nav-label{' +
  'font-size:var(--pw-chrome-label,13px)!important;line-height:1.15}'

/** Bold / gap / radius / hover / chữ ngang–dọc — mọi nút chức năng. */
export const PW_CHROME_FACE_EXTRAS_CSS =
  '[data-pw-chrome-btn].pw-chrome-has-label,[data-pw-chrome-added].pw-chrome-has-label,' +
  '[data-pw-chrome-btn][data-pw-chrome-style="icon-label"],[data-pw-chrome-added][data-pw-chrome-style="icon-label"],' +
  '[data-pw-chrome-btn][data-pw-chrome-style="icon-label-below"],[data-pw-chrome-added][data-pw-chrome-style="icon-label-below"],' +
  '[data-pw-chrome-btn][data-pw-chrome-style="icon-label-left"],[data-pw-chrome-added][data-pw-chrome-style="icon-label-left"],' +
  '[data-pw-el="cat-toggle"].pw-chrome-has-label,' +
  '[data-pw-chrome-btn][data-pw-chrome-style="text"],[data-pw-chrome-added][data-pw-chrome-style="text"]{' +
  'gap:var(--pw-chrome-gap,6px)!important}' +
  '[data-pw-chrome-weight="700"],[data-pw-chrome-weight="700"] .pw-chrome-btn-label,' +
  '[data-pw-chrome-weight="700"] .pw-shop-nav-label,[data-pw-chrome-weight="700"] .pw-shop-icon-label,' +
  '[data-pw-chrome-weight="700"] .pw-account-btn-label,[data-pw-chrome-weight="700"] .pw-shop-search-submit-label{' +
  'font-weight:700!important}' +
  '[data-pw-chrome-weight="400"],[data-pw-chrome-weight="400"] .pw-chrome-btn-label,' +
  '[data-pw-chrome-weight="400"] .pw-shop-nav-label,[data-pw-chrome-weight="400"] .pw-shop-icon-label,' +
  '[data-pw-chrome-weight="400"] .pw-account-btn-label,[data-pw-chrome-weight="400"] .pw-shop-search-submit-label{' +
  'font-weight:400!important}' +
  '[data-pw-chrome-radius]{border-radius:var(--pw-chrome-radius,0px)!important}' +
  '[data-pw-chrome-hover]:hover,[data-pw-chrome-hover]:hover .pw-chrome-btn-label,' +
  '[data-pw-chrome-hover]:hover .pw-shop-nav-label,[data-pw-chrome-hover]:hover .pw-shop-icon-label,' +
  '[data-pw-chrome-hover]:hover .pw-account-btn-label,[data-pw-chrome-hover]:hover .pw-shop-search-submit-label{' +
  'color:var(--pw-chrome-hover)!important}' +
  '[data-pw-chrome-hover]:hover svg,[data-pw-chrome-hover]:hover .pw-chrome-icon-wrap{' +
  'color:var(--pw-chrome-hover)!important;stroke:var(--pw-chrome-hover)!important}' +
  '[data-pw-chrome-hover]:hover svg path,[data-pw-chrome-hover]:hover svg circle,' +
  '[data-pw-chrome-hover]:hover svg line,[data-pw-chrome-hover]:hover svg polyline,' +
  '[data-pw-chrome-hover]:hover svg rect,[data-pw-chrome-hover]:hover svg polygon{' +
  'stroke:var(--pw-chrome-hover)!important}' +
  '[data-pw-chrome-text-flow="row"] .pw-chrome-btn-label,[data-pw-chrome-text-flow="row"] .pw-shop-nav-label,' +
  '[data-pw-chrome-text-flow="row"] .pw-shop-icon-label,[data-pw-chrome-text-flow="row"] .pw-account-btn-label,' +
  '[data-pw-chrome-text-flow="row"] .pw-shop-search-submit-label,' +
  '[data-pw-el="cat-toggle"][data-pw-chrome-text-flow="row"] .pw-chrome-btn-label,' +
  '[data-pw-el="cat-toggle"][data-pw-chrome-text-flow="row"] .pw-shop-nav-label,' +
  '[data-pw-chrome-style="icon-label-below"]:not([data-pw-chrome-text-flow="col"]) .pw-chrome-btn-label,' +
  '[data-pw-chrome-style="icon-label-below"]:not([data-pw-chrome-text-flow="col"]) .pw-shop-nav-label,' +
  '[data-pw-chrome-style="icon-label-below"]:not([data-pw-chrome-text-flow="col"]) .pw-shop-icon-label,' +
  '.pw-chrome-label-below:not([data-pw-chrome-text-flow="col"]) .pw-chrome-btn-label,' +
  '.pw-chrome-label-below:not([data-pw-chrome-text-flow="col"]) .pw-shop-nav-label,' +
  '.pw-chrome-label-below:not([data-pw-chrome-text-flow="col"]) .pw-shop-icon-label{' +
  'writing-mode:horizontal-tb!important;text-orientation:mixed!important;' +
  'white-space:nowrap!important;max-width:none!important;width:auto!important;' +
  'overflow:visible!important;word-break:normal!important;overflow-wrap:normal!important}' +
  '[data-pw-chrome-text-flow="col"] .pw-chrome-btn-label,[data-pw-chrome-text-flow="col"] .pw-shop-nav-label,' +
  '[data-pw-chrome-text-flow="col"] .pw-shop-icon-label,[data-pw-chrome-text-flow="col"] .pw-account-btn-label,' +
  '[data-pw-chrome-text-flow="col"] .pw-shop-search-submit-label,' +
  '[data-pw-el="cat-toggle"][data-pw-chrome-text-flow="col"] .pw-chrome-btn-label,' +
  '[data-pw-chrome-style="text"][data-pw-chrome-text-flow="col"]{' +
  'writing-mode:horizontal-tb!important;text-orientation:mixed!important;' +
  'white-space:normal!important;width:min-content!important;max-width:min-content!important;' +
  'word-break:keep-all!important;overflow-wrap:normal!important;text-align:center!important}'

/** Chỉ chữ — hide leftover wrap/svg even when chrome CSS uses display:inline-flex!important. */
export const PW_CHROME_TEXT_ONLY_HIDE_ICON_CSS =
  '[data-pw-chrome-style="text"] .pw-chrome-icon-wrap,.pw-chrome-link .pw-chrome-icon-wrap,' +
  '[data-pw-chrome-style="text"]>svg,.pw-chrome-link>svg,' +
  '[data-pw-chrome-style="text"] .pw-chrome-icon-wrap svg,.pw-chrome-link .pw-chrome-icon-wrap svg,' +
  '[data-pw-chrome-style="text"] .pw-chrome-chat-logo,.pw-chrome-link .pw-chrome-chat-logo,' +
  '.pw-bottom-nav [data-pw-chrome-style="text"] .pw-chrome-icon-wrap,.pw-shop-bottom-nav [data-pw-chrome-style="text"] .pw-chrome-icon-wrap,' +
  '.pw-bottom-nav .pw-chrome-link .pw-chrome-icon-wrap,.pw-shop-bottom-nav .pw-chrome-link .pw-chrome-icon-wrap,' +
  '.pw-bottom-nav [data-pw-chrome-added][data-pw-chrome-style="text"] .pw-chrome-icon-wrap,' +
  '.pw-shop-bottom-nav [data-pw-chrome-added][data-pw-chrome-style="text"] .pw-chrome-icon-wrap' +
  '{display:none!important;visibility:hidden!important;width:0!important;height:0!important;max-width:0!important;max-height:0!important;overflow:hidden!important;flex:0 0 0!important;margin:0!important;padding:0!important}'

export function chromeIconBoxCss(width: number, height: number): string {
  const w = clampPwChromeIconSize(width)
  const h = clampPwChromeIconSize(height)
  const size = w === h ? w : clampPwChromeIconSize(Math.round((w + h) / 2))
  return `--pw-chrome-size:${size}px;--pw-chrome-w:${w}px;--pw-chrome-h:${h}px`
}

function chromeSizeAttrs(
  size?: number | null,
  width?: number | null,
  height?: number | null
): string {
  const n = clampPwChromeIconSize(size)
  const w = width != null ? clampPwChromeIconSize(width) : n
  const h = height != null ? clampPwChromeIconSize(height) : n
  const extra = w === h ? '' : ` data-pw-chrome-w="${w}" data-pw-chrome-h="${h}"`
  return ` data-pw-chrome-size="${w === h ? w : clampPwChromeIconSize(Math.round((w + h) / 2))}"${extra} style="${chromeIconBoxCss(w, h)}"`
}

export const VISUAL_EDITOR_CHROME_WIDGET_KINDS = [
  'home',
  'products',
  'categories',
  'search',
  'search-image',
  'sale',
  'cart',
  'wishlist',
  'favorite-product',
  'add-cart',
  'buy-now',
  'recently-viewed',
  'try-on',
  'chat',
  'chat-zalo',
  'chat-facebook',
  'chat-instagram',
  'chat-whatsapp',
  'phone',
  'share',
  'coupon',
  'lead-form',
  'topup',
  'account',
  'login',
  'register',
  'logout',
  'orders',
  'order-tracking',
  'wallet',
  'addresses',
  'edit-profile',
  'notifications',
  'security',
  'install-app',
  'contact',
  'about',
  'faq',
  'shipping',
  'returns',
  'payment',
  'stores',
  'lookbook',
  'size-guide',
  'blog',
  'privacy',
  'terms',
  'favorites-link',
  'orders-link',
] as const

export type VisualEditorChromeWidgetKind = (typeof VISUAL_EDITOR_CHROME_WIDGET_KINDS)[number]

export type VisualEditorChromeWidgetHost = 'actions' | 'topbar' | 'mid' | 'nav' | 'float' | 'canvas'

export const VISUAL_EDITOR_CHROME_WIDGET_PLACES = ['header', 'mid', 'nav'] as const
export type VisualEditorChromeWidgetPlace = (typeof VISUAL_EDITOR_CHROME_WIDGET_PLACES)[number]

export type VisualEditorChromeWidgetAppearance = 'icon' | 'link'

export const VISUAL_EDITOR_CHROME_WIDGET_STYLES = [
  'icon',
  'icon-square',
  'icon-label',
  'icon-label-below',
  'icon-label-left',
  'text',
] as const
export type VisualEditorChromeWidgetStyle = (typeof VISUAL_EDITOR_CHROME_WIDGET_STYLES)[number]

export function isChromeIconOnlyStyle(style?: string | null): boolean {
  return style === 'icon' || style === 'icon-square'
}

export function isChromeIconLabelStyle(style?: string | null): boolean {
  return style === 'icon-label' || style === 'icon-label-below' || style === 'icon-label-left'
}

function chromeFaceClass(style?: VisualEditorChromeWidgetStyle): {
  withLabel: boolean
  styleClass: string
  styleAttr: 'icon' | 'icon-square' | 'icon-label' | 'icon-label-below' | 'icon-label-left'
} {
  if (style === 'icon-square') {
    return {
      withLabel: false,
      styleClass: 'pw-chrome-icon-only pw-chrome-icon-square',
      styleAttr: 'icon-square',
    }
  }
  if (style === 'icon-label-below') {
    return {
      withLabel: true,
      styleClass: 'pw-chrome-has-label pw-chrome-label-below',
      styleAttr: 'icon-label-below',
    }
  }
  if (style === 'icon-label-left') {
    return {
      withLabel: true,
      styleClass: 'pw-chrome-has-label pw-chrome-label-left',
      styleAttr: 'icon-label-left',
    }
  }
  const withLabel = style !== 'icon'
  return {
    withLabel,
    styleClass: withLabel ? 'pw-chrome-has-label' : 'pw-chrome-icon-only',
    styleAttr: withLabel ? 'icon-label' : 'icon',
  }
}

export type VisualEditorChromeWidgetPickerGroupId = VisualEditorChromeWidgetPlace

export const VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS: VisualEditorChromeWidgetKind[] = [
  'home',
  'products',
  'categories',
  'search',
  'search-image',
  'sale',
  'cart',
  'wishlist',
  'favorite-product',
  'add-cart',
  'buy-now',
  'recently-viewed',
  'try-on',
  'chat',
  'chat-zalo',
  'chat-facebook',
  'chat-instagram',
  'chat-whatsapp',
  'phone',
  'share',
  'coupon',
  'lead-form',
  'topup',
  'account',
  'login',
  'register',
  'logout',
  'orders',
  'order-tracking',
  'wallet',
  'addresses',
  'edit-profile',
  'notifications',
  'security',
  'install-app',
  'contact',
  'about',
  'faq',
  'shipping',
  'returns',
  'payment',
  'stores',
  'lookbook',
  'size-guide',
  'blog',
  'privacy',
  'terms',
]

export const VISUAL_EDITOR_CHROME_WIDGET_PICKER_GROUPS: {
  id: VisualEditorChromeWidgetPickerGroupId
  kinds: VisualEditorChromeWidgetKind[]
}[] = VISUAL_EDITOR_CHROME_WIDGET_PLACES.map((id) => ({
  id,
  kinds: VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS,
}))

function chromeKindSvg(kind: VisualEditorChromeWidgetKind, glyph?: string | null): string {
  if (kind === 'search') return searchGlyphSvg('lens', 'pw-shop-nav-icon pw-shop-search-submit-icon')
  if (kind === 'search-image') return searchGlyphSvg('camera')
  if (!canPickChromeGlyph(kind)) return ''
  return chromeGlyphSvg(normalizeChromeGlyph(kind, glyph))
}

function chromeGlyphAttr(kind: VisualEditorChromeWidgetKind, glyph?: string | null): string {
  if (!canPickChromeGlyph(kind)) return ''
  const id = normalizeChromeGlyph(kind, glyph)
  return id ? ` data-pw-chrome-glyph="${id}"` : ''
}

const ICON_BADGE_KINDS = new Set<VisualEditorChromeWidgetKind>([
  'wishlist',
  'recently-viewed',
  'cart',
  'notifications',
])

const TOPBAR_DEFAULT_KINDS = new Set<VisualEditorChromeWidgetKind>([
  'contact',
  'login',
  'favorites-link',
  'orders-link',
  'about',
  'faq',
  'shipping',
  'returns',
  'privacy',
  'terms',
  'payment',
  'stores',
  'lookbook',
  'size-guide',
  'blog',
  'sale',
])

export function isVisualEditorChromeWidgetKind(value: string): value is VisualEditorChromeWidgetKind {
  return (VISUAL_EDITOR_CHROME_WIDGET_KINDS as readonly string[]).includes(value)
}

export function chromeWidgetHost(
  kind: VisualEditorChromeWidgetKind,
  _style?: VisualEditorChromeWidgetStyle,
  _place?: VisualEditorChromeWidgetPlace
): VisualEditorChromeWidgetHost {
  if (isChromeFloatKind(kind)) return 'float'
  return 'canvas'
}

export function chromeWidgetAppearance(
  kind: VisualEditorChromeWidgetKind,
  style?: VisualEditorChromeWidgetStyle
): VisualEditorChromeWidgetAppearance {
  if (style === 'text') return 'link'
  if (style === 'icon' || style === 'icon-square' || isChromeIconLabelStyle(style)) return 'icon'
  if (TOPBAR_DEFAULT_KINDS.has(kind)) return 'link'
  return 'icon'
}

/** How a Thêm-phần-tử widget talks to the live shop — serve-time, every tenant. */
export type ChromeWidgetLiveHook =
  | 'route'
  | 'search'
  | 'search-image'
  | 'categories'
  | 'chat'
  | 'contact'
  | 'topup'
  | 'try-on'
  | 'favorite'
  | 'add-cart'
  | 'buy-now'
  | 'share'
  | 'logout'
  | 'coupon'
  | 'lead'

export function isProductActionChromeKind(
  kind: string
): kind is 'try-on' | 'favorite-product' | 'add-cart' | 'buy-now' {
  return kind === 'try-on' || kind === 'favorite-product' || kind === 'add-cart' || kind === 'buy-now'
}

export function isProductHostChromeKind(kind: string): kind is 'favorite-product' | 'add-cart' | 'buy-now' {
  return kind === 'favorite-product' || kind === 'add-cart' || kind === 'buy-now'
}

export function chromeWidgetLiveHook(kind: VisualEditorChromeWidgetKind): ChromeWidgetLiveHook {
  if (kind === 'search') return 'search'
  if (kind === 'search-image') return 'search-image'
  if (kind === 'categories') return 'categories'
  if (kind === 'chat') return 'chat'
  if (
    kind === 'chat-zalo' ||
    kind === 'chat-facebook' ||
    kind === 'chat-instagram' ||
    kind === 'chat-whatsapp' ||
    kind === 'phone'
  ) {
    return 'contact'
  }
  if (kind === 'topup') return 'topup'
  if (kind === 'try-on') return 'try-on'
  if (kind === 'favorite-product') return 'favorite'
  if (kind === 'add-cart') return 'add-cart'
  if (kind === 'buy-now') return 'buy-now'
  if (kind === 'share') return 'share'
  if (kind === 'logout') return 'logout'
  if (kind === 'coupon') return 'coupon'
  if (kind === 'lead-form') return 'lead'
  return 'route'
}

export function chromeWidgetHref(kind: VisualEditorChromeWidgetKind, siteSlug: string): string {
  const slug = siteSlug.trim()
  if (kind === 'home') return partnerSiteHomePath(slug)
  if (kind === 'products' || kind === 'categories' || kind === 'search' || kind === 'search-image') {
    return partnerSiteProductsPath(slug)
  }
  if (kind === 'sale') return partnerSiteInfoPath(slug, 'sale')
  if (kind === 'wishlist' || kind === 'favorites-link') return partnerSiteWishlistPath(slug)
  if (kind === 'recently-viewed') return partnerSiteRecentlyViewedPath(slug)
  if (kind === 'cart') return partnerSiteCartPath(slug)
  if (
    kind === 'chat' ||
    kind === 'chat-zalo' ||
    kind === 'chat-facebook' ||
    kind === 'chat-instagram' ||
    kind === 'chat-whatsapp' ||
    kind === 'phone' ||
    kind === 'topup' ||
    kind === 'share' ||
    kind === 'logout' ||
    kind === 'coupon' ||
    kind === 'lead-form'
  ) {
    return '#'
  }
  if (kind === 'try-on' || kind === 'favorite-product' || kind === 'add-cart' || kind === 'buy-now') return '#'
  if (kind === 'register') return partnerSiteLoginPath(slug)
  if (kind === 'orders' || kind === 'orders-link') return partnerSiteOrdersPath(slug)
  if (kind === 'order-tracking') return partnerSiteOrderTrackingPath(slug)
  if (kind === 'account') return partnerSiteAccountPath(slug)
  if (kind === 'addresses') return partnerSiteAddressesPath(slug)
  if (kind === 'wallet') return partnerSiteAccountTabPath(slug, 'wallet')
  if (kind === 'edit-profile') return partnerSiteAccountEditPath(slug)
  if (kind === 'notifications') return partnerSiteAccountTabPath(slug, 'notifications')
  if (kind === 'security') return partnerSiteAccountTabPath(slug, 'security')
  if (kind === 'install-app') return partnerSiteAccountTabPath(slug, 'install-app')
  if (kind === 'contact') return partnerSiteInfoPath(slug, 'contact')
  if (kind === 'about') return partnerSiteInfoPath(slug, 'about')
  if (kind === 'faq') return partnerSiteInfoPath(slug, 'faq')
  if (kind === 'shipping') return partnerSiteInfoPath(slug, 'shipping')
  if (kind === 'returns') return partnerSiteInfoPath(slug, 'returns')
  if (kind === 'payment') return partnerSiteInfoPath(slug, 'payment')
  if (kind === 'stores') return partnerSiteInfoPath(slug, 'stores')
  if (kind === 'lookbook') return partnerSiteInfoPath(slug, 'lookbook')
  if (kind === 'size-guide') return partnerSiteInfoPath(slug, 'size-guide')
  if (kind === 'blog') return partnerSiteInfoPath(slug, 'blog')
  if (kind === 'privacy') return partnerSiteInfoPath(slug, 'privacy')
  if (kind === 'terms') return partnerSiteInfoPath(slug, 'terms')
  if (kind === 'login') return partnerSiteLoginPath(slug)
  return partnerSiteAccountPath(slug)
}

export function chromeKindDefaultLabels(locale: WebLocale): Record<string, string> {
  const o: Record<string, string> = {}
  for (const kind of VISUAL_EDITOR_CHROME_WIDGET_KINDS) {
    o[kind] = chromeWidgetLabel(kind, locale)
  }
  return o
}

export function chromeWidgetLabel(kind: VisualEditorChromeWidgetKind, locale: WebLocale): string {
  const shop = getPartnerSiteShopCopy(locale)
  const nav = getPartnerSiteCategoryNavLabels(locale)
  if (kind === 'home') return shop.navHome
  if (kind === 'products') return shop.navProducts
  if (kind === 'categories') return shop.navCategories
  if (kind === 'search') return shop.searchPlaceholder.replace(/[.…]+$/, '').trim() || shop.searchPlaceholder
  if (kind === 'search-image') return shop.searchByImage
  if (kind === 'sale') return nav.sale
  if (kind === 'wishlist' || kind === 'favorites-link') return shop.navFavorites
  if (kind === 'favorite-product') return shop.favoriteProduct
  if (kind === 'add-cart') return shop.pdpAddToCartShort
  if (kind === 'buy-now') return shop.pdpBuyNowShort
  if (kind === 'try-on') return shop.tryOnLink
  if (kind === 'recently-viewed') return shop.navRecentlyViewed
  if (kind === 'cart') return shop.navCart
  if (kind === 'chat') return shop.navChat
  if (kind === 'chat-zalo') return shop.navChatZalo
  if (kind === 'chat-facebook') return shop.navChatFacebook
  if (kind === 'chat-instagram') return shop.contactChannelInstagram
  if (kind === 'chat-whatsapp') return shop.navChatWhatsapp
  if (kind === 'phone') return shop.contactChannelPhone
  if (kind === 'share') return shop.pdpShareCopy
  if (kind === 'coupon') return shop.cartPromoLabel
  if (kind === 'lead-form') return shop.leadFormTitle
  if (kind === 'register') return shop.navRegister
  if (kind === 'logout') return shop.navLogout
  if (kind === 'topup') return shop.navTopUp
  if (kind === 'orders' || kind === 'orders-link') return shop.navOrders
  if (kind === 'order-tracking') return shop.orderTrack
  if (kind === 'account') return shop.navAccount
  if (kind === 'addresses') return shop.accountAddressBook
  if (kind === 'wallet') return shop.navWallet
  if (kind === 'edit-profile') return shop.accountEditProfile
  if (kind === 'notifications') return shop.accountNotifications
  if (kind === 'security') return shop.accountSecurity
  if (kind === 'install-app') return shop.accountInstallApp
  if (kind === 'contact') return nav.contact
  if (kind === 'about') return nav.about
  if (kind === 'faq') return nav.faq
  if (kind === 'shipping') return nav.shipping
  if (kind === 'returns') return nav.returns
  if (kind === 'payment') return nav.payment
  if (kind === 'stores') return nav.stores
  if (kind === 'lookbook') return nav.lookbook
  if (kind === 'size-guide') return nav.sizeGuide
  if (kind === 'blog') return nav.blog
  if (kind === 'privacy') return nav.privacy
  if (kind === 'terms') return nav.terms
  return nav.login
}

export function htmlHasChromeChatMua(html: string): boolean {
  return /data-pw-chrome-btn=["']chat["']/i.test(html)
}

export { isChromeFloatKind } from '@/lib/partner-website/shop/chrome-float-widgets'

export function isChromeContactChatKind(
  kind: string
): kind is 'chat-zalo' | 'chat-facebook' | 'chat-instagram' | 'chat-whatsapp' {
  return (
    kind === 'chat-zalo' ||
    kind === 'chat-facebook' ||
    kind === 'chat-instagram' ||
    kind === 'chat-whatsapp'
  )
}

export function isChromeContactLiveKind(
  kind: string
): kind is 'chat-zalo' | 'chat-facebook' | 'chat-instagram' | 'chat-whatsapp' | 'phone' {
  return isChromeContactChatKind(kind) || kind === 'phone'
}

export function chromeContactChannelOf(
  kind: string
): 'zalo' | 'facebook' | 'instagram' | 'whatsapp' | 'phone' | '' {
  if (kind === 'chat-zalo') return 'zalo'
  if (kind === 'chat-facebook') return 'facebook'
  if (kind === 'chat-instagram') return 'instagram'
  if (kind === 'chat-whatsapp') return 'whatsapp'
  if (kind === 'phone') return 'phone'
  return ''
}

export function chromeContactLiveHref(kind: string, href?: string | null): string | null {
  const raw = typeof href === 'string' ? href.trim() : ''
  if (kind === 'phone') {
    const phone = normalizeContactPhone(raw.replace(/^tel:/i, ''))
    return phone ? partnerSiteTelHref(phone) : null
  }
  if (kind === 'chat-whatsapp') {
    const url = normalizeContactHttpUrl(raw)
    if (url) return url
    const phone = normalizeContactPhone(raw.replace(/^tel:/i, ''))
    return phone ? partnerSiteWhatsAppHref(phone) || null : null
  }
  return normalizeContactHttpUrl(raw)
}

/** Logo chính thức Zalo (màu thương hiệu Zalo, không phải --pw-*). */
export const CHROME_ZALO_LOGO_SVG =
  '<svg class="pw-chrome-brand-logo" width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" fill="#0068FF"/><path fill="#fff" d="M15 16.5h18v3.4L22.2 31.2H33.2V35H15v-3.4L25.8 19.9H15z"/></svg>'

/** Logo chính thức Facebook (màu thương hiệu Facebook, không phải --pw-*). */
export const CHROME_FACEBOOK_CHAT_LOGO_SVG =
  '<svg class="pw-chrome-brand-logo" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path fill="#fff" d="M13.2 19.2v-6.05h2.03l.3-2.35h-2.33V9.28c0-.68.19-1.15 1.17-1.15h1.25V6.02A16.4 16.4 0 0 0 13.4 5.9c-2.05 0-3.46 1.25-3.46 3.55v1.35H7.8v2.35h2.14V19.2h3.26z"/></svg>'

/** Logo chính thức Instagram (màu thương hiệu, không phải --pw-*). */
export const CHROME_INSTAGRAM_LOGO_SVG =
  '<svg class="pw-chrome-brand-logo" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="pwIg" x1="0" y1="24" x2="24" y2="0"><stop offset="0" stop-color="#f58529"/><stop offset="0.5" stop-color="#dd2a7b"/><stop offset="1" stop-color="#8134af"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#pwIg)"/><rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" stroke-width="1.7"/><circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" stroke-width="1.7"/><circle cx="16.4" cy="7.6" r="1" fill="#fff"/></svg>'

/** Logo chính thức WhatsApp (màu thương hiệu, không phải --pw-*). */
export const CHROME_WHATSAPP_LOGO_SVG =
  '<svg class="pw-chrome-brand-logo" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#25D366"/><path fill="#fff" d="M16.7 14.3c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1-.1.2-.6.7-.7.8-.1.1-.3.2-.5.1-.2-.1-.9-.3-1.7-1-.6-.6-1.1-1.3-1.2-1.5-.1-.2 0-.4.1-.5l.4-.4c.1-.1.1-.3.2-.4 0-.1 0-.3 0-.4s-.5-1.1-.6-1.5c-.2-.4-.4-.3-.5-.3h-.4c-.1 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.6 2.5 3.8 3.4.5.2.9.4 1.3.5.5.2 1 .1 1.4.1.4 0 1.2-.5 1.4-1 .2-.5.2-.9.1-1 0-.1-.2-.1-.4-.2z"/></svg>'

export function chromeContactChatLogoSvg(
  kind: 'chat-zalo' | 'chat-facebook' | 'chat-instagram' | 'chat-whatsapp'
): string {
  if (kind === 'chat-zalo') return CHROME_ZALO_LOGO_SVG
  if (kind === 'chat-facebook') return CHROME_FACEBOOK_CHAT_LOGO_SVG
  if (kind === 'chat-instagram') return CHROME_INSTAGRAM_LOGO_SVG
  return CHROME_WHATSAPP_LOGO_SVG
}

/** Nút Chat mua — logo shop + `data-nanoai-open-chat` (API chat nhúng). Không phải FAB NanoAI. */
export function buildPartnerSiteChatMuaButtonHtml(input: {
  siteSlug?: string | null
  locale: WebLocale
  style?: VisualEditorChromeWidgetStyle
  place?: VisualEditorChromeWidgetPlace
  logoUrl?: string | null
  /** Logo icon Chat mua dùng chung mọi máy — ưu tiên hơn logo shop. */
  chatIconLogoUrl?: string | null
}): string {
  return buildVisualEditorChromeWidgetHtml({
    kind: 'chat',
    siteSlug: input.siteSlug?.trim() || 'shop',
    locale: input.locale,
    style: input.style ?? 'icon',
    place: input.place ?? 'header',
    logoUrl: input.logoUrl,
    chatIconLogoUrl: input.chatIconLogoUrl,
  })
}

/** Icon / topbar link wired to shop routes + badge APIs (`data-pw-chrome-btn`). */
function chromeChatLogoImg(logoUrl?: string | null): string {
  const logo = typeof logoUrl === 'string' ? logoUrl.trim() : ''
  if (!logo || !/^https?:\/\//i.test(logo)) return ''
  return `<img class="pw-chrome-chat-logo" src="${escapeAttr(logo)}" alt="" width="22" height="22" draggable="false" />`
}

const LEAD_FORM_UI: Record<
  WebLocale,
  { submit: string; success: string; error: string }
> = {
  vi: { submit: 'Gửi', success: 'Đã gửi. Shop sẽ liên hệ lại.', error: 'Không gửi được. Thử lại.' },
  en: { submit: 'Send', success: 'Sent. The shop will contact you.', error: 'Could not send. Try again.' },
  zh: { submit: '发送', success: '已发送，店铺会与您联系。', error: '发送失败，请重试。' },
  ja: { submit: '送信', success: '送信しました。店舗からご連絡します。', error: '送信できませんでした。' },
  ko: { submit: '보내기', success: '보냈습니다. 매장에서 연락드립니다.', error: '보내지 못했습니다. 다시 시도하세요.' },
}

export const PW_LEAD_COUPON_CSS = `
[data-pw-lead-form],[data-pw-coupon-form]{
  display:flex;flex-direction:column;gap:10px;
  min-width:220px;max-width:min(420px,92vw);
  padding:16px;border-radius:12px;
  background:var(--pw-surface,#fff);
  border:1px solid var(--pw-border,#e5e7eb);
  color:var(--pw-text,#111);
  box-sizing:border-box
}
[data-pw-lead-form] .pw-form,[data-pw-coupon-form] .pw-form{display:flex;flex-direction:column;gap:8px}
[data-pw-lead-form] label,[data-pw-coupon-form] label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--pw-muted,#6b7280)}
[data-pw-lead-form] input,[data-pw-lead-form] textarea,[data-pw-coupon-form] input{
  border:1px solid var(--pw-border,#e5e7eb);border-radius:8px;padding:8px 10px;
  background:#fff;color:var(--pw-text,#111);font:inherit
}
[data-pw-lead-form] button,[data-pw-coupon-form] button{
  background:var(--pw-buy,var(--pw-primary,#111));color:#fff;border:0;border-radius:8px;
  padding:9px 12px;font-weight:600;cursor:pointer
}
[data-pw-lead-form] .pw-form-ok,[data-pw-coupon-form] .pw-form-ok{color:#15803d;font-size:12px}
[data-pw-lead-form] .pw-form-err,[data-pw-coupon-form] .pw-form-err{color:#b91c1c;font-size:12px}
`.trim()

export function buildVisualEditorLeadFormHtml(siteSlug: string, locale: WebLocale): string {
  const slug = siteSlug.trim()
  if (!slug) return ''
  const shop = getPartnerSiteShopCopy(locale)
  const ui = LEAD_FORM_UI[locale] || LEAD_FORM_UI.en
  const api = escapeAttr(partnerSiteLeadApiPath(slug))
  return `<section class="pw-lead-form pw-section" data-pw-region="form" data-pw-lead-form="1" data-pw-chrome-btn="lead-form" data-pw-chrome-added="1" id="lead-form">
  <h2 class="pw-section-title" data-pw-el="title">${escapeHtml(shop.leadFormTitle)}</h2>
  <form class="pw-form" data-pw-lead-form-el data-api="${api}" data-success="${escapeAttr(ui.success)}" data-error="${escapeAttr(ui.error)}">
    <label data-pw-el="label">${escapeHtml(shop.checkoutName)}<input name="name" type="text" required maxlength="200" data-pw-el="field"/></label>
    <label data-pw-el="label">${escapeHtml(shop.checkoutPhone)}<input name="phone" type="tel" maxlength="50" data-pw-el="field"/></label>
    <label data-pw-el="label">${escapeHtml(shop.accountEmailLabel)}<input name="email" type="email" maxlength="200" data-pw-el="field"/></label>
    <label data-pw-el="label">${escapeHtml(shop.checkoutNote)}<textarea name="message" rows="3" maxlength="4000" data-pw-el="field"></textarea></label>
    <button type="submit" class="pw-btn pw-btn-accent" data-pw-el="submit">${escapeHtml(ui.submit)}</button>
    <p class="pw-form-msg" hidden></p>
  </form>
</section>`
}

export function buildVisualEditorCouponFormHtml(siteSlug: string, locale: WebLocale): string {
  const slug = siteSlug.trim()
  if (!slug) return ''
  const shop = getPartnerSiteShopCopy(locale)
  const api = escapeAttr(partnerSitePromotionsValidateApiPath(slug))
  return `<div class="pw-coupon-form" data-pw-region="form" data-pw-coupon-form="1" data-pw-chrome-btn="coupon" data-pw-chrome-added="1" data-pw-el="coupon">
  <form class="pw-form" data-pw-coupon-form-el data-api="${api}">
    <label data-pw-el="label">${escapeHtml(shop.cartPromoLabel)}<input name="code" type="text" required maxlength="40" placeholder="${escapeAttr(shop.cartPromoPlaceholder)}" data-pw-el="field" autocomplete="off"/></label>
    <button type="submit" class="pw-btn pw-btn-accent" data-pw-el="submit">${escapeHtml(shop.cartPromoApply)}</button>
    <p class="pw-form-msg" hidden></p>
  </form>
</div>`
}

export function buildVisualEditorChromeWidgetHtml(input: {
  kind: VisualEditorChromeWidgetKind
  siteSlug: string
  locale: WebLocale
  style?: VisualEditorChromeWidgetStyle
  place?: VisualEditorChromeWidgetPlace
  /** Logo shop / icon tin nhắn — nút Chat mua nhận tự động khi có. */
  logoUrl?: string | null
  /** Logo icon Chat mua dùng chung mọi máy — ưu tiên hơn logoUrl. */
  chatIconLogoUrl?: string | null
  /** URL Zalo / Facebook Messenger từ cài đặt web. */
  href?: string | null
  /** Cỡ icon (px), kéo to nhỏ khi thêm. */
  iconSize?: number | null
  iconWidth?: number | null
  iconHeight?: number | null
  /** Kiểu icon trong họ nút (`data-pw-chrome-glyph`). */
  glyph?: string | null
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const kind = input.kind
  const style = input.style
  const label = chromeWidgetLabel(kind, input.locale)
  const labelAttr = escapeAttr(label)
  const placeAttr = input.place ? ` data-pw-chrome-place="${input.place}"` : ''
  const sizeAttr = chromeSizeAttrs(input.iconSize, input.iconWidth, input.iconHeight)
  if (kind === 'search') {
    const shop = getPartnerSiteShopCopy(input.locale)
    const ph = escapeAttr(shop.searchPlaceholder)
    const imgLabel = escapeAttr(shop.searchByImage)
    const btnAttr = escapeAttr(shop.searchButton)
    const cameraSvg = chromeKindSvg('search-image')
    const searchSvg = chromeKindSvg('search')
    return `<div class="pw-shop-search-wrap pw-header-search" data-pw-el="search" data-pw-chrome-btn="search" data-pw-chrome-added="1"${placeAttr}${sizeAttr} draggable="false"><form class="pw-shop-search-form pw-search-form" data-pw-search-form role="search"><input data-pw-search type="search" name="q" placeholder="${ph}" aria-label="${ph}" autocomplete="off"/><button type="button" class="pw-shop-search-image pw-search-image-btn" data-pw-image-search data-pw-search-glyph="camera" aria-label="${imgLabel}" title="${imgLabel}"><span class="pw-chrome-icon-wrap">${cameraSvg}</span></button><button type="submit" class="pw-shop-search-submit pw-search-submit" data-pw-search-glyph="lens" aria-label="${btnAttr}">${searchSvg}<span class="pw-shop-search-submit-label">${escapeHtml(shop.searchButton)}</span></button></form></div>`
  }
  if (kind === 'search-image') {
    const svg = chromeKindSvg('search-image')
    const appearance = chromeWidgetAppearance(kind, style)
    if (appearance === 'link') {
      return `<button type="button" class="pw-shop-search-image pw-search-image-btn pw-chrome-link" data-pw-chrome-btn="search-image" data-pw-image-search="1" data-pw-chrome-added="1" data-pw-chrome-style="text" data-pw-search-glyph="camera"${placeAttr}${sizeAttr} aria-label="${labelAttr}" title="${labelAttr}" draggable="false">${escapeHtml(label)}</button>`
    }
    const face = chromeFaceClass(style)
    const labelHtml = face.withLabel
      ? `<span class="pw-shop-nav-label pw-chrome-btn-label">${escapeHtml(label)}</span>`
      : ''
    return `<button type="button" class="pw-shop-search-image pw-search-image-btn pw-icon-btn pw-shop-icon-btn ${face.styleClass}" data-pw-chrome-btn="search-image" data-pw-image-search="1" data-pw-chrome-added="1" data-pw-chrome-style="${face.styleAttr}" data-pw-search-glyph="camera"${placeAttr}${sizeAttr} aria-label="${labelAttr}" title="${labelAttr}" draggable="false"><span class="pw-chrome-icon-wrap">${svg}</span>${labelHtml}</button>`
  }
  if (kind === 'categories') {
    const svg = chromeKindSvg(kind, input.glyph)
    const glyphAttr = chromeGlyphAttr(kind, input.glyph)
    const appearance = chromeWidgetAppearance(kind, style)
    const panel = `<nav id="pw-shop-cat-panel" class="pw-shop-cat-panel pw-cat-panel" data-pw-cat-panel="1" aria-label="${labelAttr}"></nav>`
    if (appearance === 'link') {
      return `<span class="pw-chrome-cat-wrap" data-pw-chrome-added="1"${placeAttr}${sizeAttr}><button type="button" class="pw-shop-cat-btn pw-chrome-link" data-pw-chrome-btn="categories" data-pw-el="cat-toggle" data-pw-cat-toggle="1" data-pw-chrome-style="text"${glyphAttr} aria-expanded="false" aria-controls="pw-shop-cat-panel" aria-label="${labelAttr}" title="${labelAttr}" draggable="false">${escapeHtml(label)}</button>${panel}</span>`
    }
    const face = chromeFaceClass(style)
    const labelHtml = face.withLabel
      ? `<span class="pw-shop-nav-label pw-chrome-btn-label">${escapeHtml(label)}</span>`
      : ''
    return `<span class="pw-chrome-cat-wrap" data-pw-chrome-added="1"${placeAttr}${sizeAttr}><button type="button" class="pw-shop-cat-btn pw-icon-btn pw-shop-icon-btn ${face.styleClass}" data-pw-chrome-btn="categories" data-pw-el="cat-toggle" data-pw-cat-toggle="1" data-pw-chrome-style="${face.styleAttr}"${glyphAttr} aria-expanded="false" aria-controls="pw-shop-cat-panel" aria-label="${labelAttr}" title="${labelAttr}" draggable="false"><span class="pw-chrome-icon-wrap">${svg}</span>${labelHtml}</button>${panel}</span>`
  }
  if (kind === 'account') {
    const svg = chromeKindSvg(kind, input.glyph)
    const glyphAttr = chromeGlyphAttr(kind, input.glyph)
    const appearance = chromeWidgetAppearance(kind, style)
    const href = escapeAttr(chromeWidgetHref(kind, slug))
    if (appearance === 'link') {
      return `<a class="pw-account-btn pw-chrome-link" href="${href}" data-pw-el="account" data-pw-chrome-btn="account" data-pw-chrome-style="text"${glyphAttr} data-pw-chrome-added="1"${placeAttr}${sizeAttr} aria-label="${labelAttr}" title="${labelAttr}" draggable="false">${escapeHtml(label)}</a>`
    }
    const face = chromeFaceClass(style)
    const labelHtml = face.withLabel
      ? `<span class="pw-shop-nav-label pw-chrome-btn-label">${escapeHtml(label)}</span>`
      : ''
    return `<a class="pw-account-btn pw-icon-btn pw-shop-icon-btn ${face.styleClass}" href="${href}" data-pw-el="account" data-pw-chrome-btn="account" data-pw-chrome-style="${face.styleAttr}"${glyphAttr} data-pw-chrome-added="1"${placeAttr}${sizeAttr} aria-label="${labelAttr}" title="${labelAttr}" draggable="false"><span class="pw-chrome-icon-wrap">${svg}</span>${labelHtml}</a>`
  }
  if (kind === 'lead-form') {
    return buildVisualEditorLeadFormHtml(slug, input.locale)
  }
  if (kind === 'coupon') {
    return buildVisualEditorCouponFormHtml(slug, input.locale)
  }
  const isContactLive = isChromeContactLiveKind(kind)
  const isContactChat = isChromeContactChatKind(kind)
  const contactHref = isContactLive ? chromeContactLiveHref(kind, input.href) : null
  const routeHref =
    isContactLive ||
    isChromeFloatKind(kind) ||
    isProductActionChromeKind(kind) ||
    kind === 'share' ||
    kind === 'logout'
      ? ''
      : chromeWidgetHref(kind, slug)
  const href = escapeAttr(contactHref || routeHref)
  const isChat = kind === 'chat'
  const isTryOn = kind === 'try-on'
  const isFavoriteProduct = kind === 'favorite-product'
  const isAddCart = kind === 'add-cart'
  const isBuyNow = kind === 'buy-now'
  const isActionBtn =
    isChat ||
    kind === 'topup' ||
    isTryOn ||
    isFavoriteProduct ||
    isAddCart ||
    isBuyNow ||
    kind === 'share' ||
    kind === 'logout'
  const floatAttr = isChromeFloatKind(kind) ? ' data-pw-chrome-float="1"' : ''
  const customChatIcon =
    isChat &&
    typeof input.chatIconLogoUrl === 'string' &&
    /^https?:\/\//i.test(input.chatIconLogoUrl.trim())
  const chatLogoSrc = customChatIcon ? input.chatIconLogoUrl : input.logoUrl
  const chatIconAttr = customChatIcon ? ' data-pw-chat-icon-logo="1"' : ''
  const chatAttr = isChat ? ' data-nanoai-open-chat' : ''
  const tryOnAttr = isTryOn ? ' data-nanoai-try-on' : ''
  const favoriteAttr = isFavoriteProduct ? ' data-pw-favorite' : ''
  const addCartAttr = isAddCart ? ' data-pw-add-cart' : ''
  const buyAttr = isBuyNow ? ' data-pw-buy' : ''
  const contactChannel = chromeContactChannelOf(kind)
  const contactAttr = isContactLive
    ? ` data-pw-contact-channel="${contactChannel}"${
        contactHref
          ? kind === 'phone'
            ? ''
            : ' target="_blank" rel="noopener noreferrer"'
          : ' data-pw-contact-pending="1" aria-disabled="true"'
      }`
    : ''
  const shareAttr = kind === 'share' ? ' data-pw-share="1"' : ''
  const logoutAttr = kind === 'logout' ? ' data-pw-account-logout="1"' : ''
  const openTag = isActionBtn
    ? `<button type="button" class="`
    : `<a class="`
  const closeTag = isActionBtn ? '</button>' : '</a>'
  const hrefAttr = isActionBtn || !href ? '' : ` href="${href}"`
  const countAttr = ICON_BADGE_KINDS.has(kind) ? ' data-pw-chrome-count="1"' : ''
  const elRole = kind === 'cart' ? ' data-pw-el="cart"' : isAddCart ? ' data-pw-el="card-cart"' : isBuyNow ? ' data-pw-el="buy"' : ''
  const liveAttr = `${chatAttr}${tryOnAttr}${favoriteAttr}${addCartAttr}${buyAttr}${chatIconAttr}${contactAttr}${shareAttr}${logoutAttr}`
  const glyphAttr = chromeGlyphAttr(kind, input.glyph)
  if (chromeWidgetAppearance(kind, style) === 'link') {
    const ctaClass = isAddCart ? ' pw-shop-btn pw-shop-btn-cart' : isBuyNow ? ' pw-shop-btn pw-shop-btn-buy' : ''
    return `${openTag}pw-chrome-link${isChat ? ' pw-chat-open' : ''}${ctaClass}" data-pw-chrome-btn="${kind}" data-pw-chrome-added="1" data-pw-chrome-style="text"${glyphAttr}${elRole}${placeAttr}${sizeAttr}${floatAttr}${hrefAttr}${liveAttr} draggable="false">${escapeHtml(label)}${closeTag}`
  }
  const chatLogo = isChat ? chromeChatLogoImg(chatLogoSrc) : ''
  const brandLogo = isContactChat ? chromeContactChatLogoSvg(kind) : ''
  const svg = chatLogo || brandLogo || chromeKindSvg(kind, input.glyph) || chromeKindSvg('account')
  const badge = ICON_BADGE_KINDS.has(kind)
    ? '<span class="pw-cart-badge pw-shop-cart-badge" data-pw-chrome-badge hidden>0</span>'
    : ''
  const face = chromeFaceClass(style)
  const labelHtml = face.withLabel
    ? `<span class="pw-shop-nav-label pw-chrome-btn-label">${escapeHtml(label)}</span>`
    : ''
  const iconHtml = `<span class="pw-chrome-icon-wrap">${svg}${badge}</span>`
  const chatClass = isChat ? ' pw-chat-open' : ''
  const ctaFace = isAddCart ? ' pw-shop-btn-cart' : isBuyNow ? ' pw-shop-btn-buy' : ''
  return `${openTag}pw-icon-btn pw-shop-icon-btn ${face.styleClass}${chatClass}${ctaFace}" data-pw-chrome-btn="${kind}" data-pw-chrome-added="1" data-pw-chrome-style="${face.styleAttr}"${glyphAttr}${elRole}${countAttr}${placeAttr}${sizeAttr}${floatAttr}${hrefAttr}${liveAttr} aria-label="${labelAttr}" title="${labelAttr}" draggable="false">${iconHtml}${labelHtml}${closeTag}`
}
