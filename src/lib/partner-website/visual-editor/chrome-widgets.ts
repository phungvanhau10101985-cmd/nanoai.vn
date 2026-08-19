import type { WebLocale } from '@/lib/i18n/config'
import {
  getPartnerSiteAccountMenuItems,
  getPartnerSiteCategoryNavLabels,
  partnerSiteAccountMenuIconSvg,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { normalizeContactHttpUrl } from '@/lib/partner-website/shop/partner-site-contact-channels'
import { isChromeFloatKind } from '@/lib/partner-website/shop/chrome-float-widgets'
import {
  partnerSiteAccountEditPath,
  partnerSiteAccountPath,
  partnerSiteAccountTabPath,
  partnerSiteAddressesPath,
  partnerSiteCartPath,
  partnerSiteHomePath,
  partnerSiteInfoPath,
  partnerSiteNanoAiLoginHref,
  partnerSiteOrdersPath,
  partnerSiteOrderTrackingPath,
  partnerSiteProductsPath,
  partnerSiteRecentlyViewedPath,
  partnerSiteWishlistPath,
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
export const PW_CHROME_ICON_SIZE_MAX = 100

export function clampPwChromeIconSize(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return PW_CHROME_ICON_SIZE_DEFAULT
  return Math.min(PW_CHROME_ICON_SIZE_MAX, Math.max(PW_CHROME_ICON_SIZE_MIN, n))
}

function chromeSizeAttrs(size?: number | null): string {
  const n = clampPwChromeIconSize(size)
  return ` data-pw-chrome-size="${n}" style="--pw-chrome-size:${n}px"`
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
  'recently-viewed',
  'chat',
  'chat-zalo',
  'chat-facebook',
  'topup',
  'account',
  'login',
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

export type VisualEditorChromeWidgetHost = 'actions' | 'topbar' | 'mid' | 'nav' | 'float'

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
  'recently-viewed',
  'chat',
  'chat-zalo',
  'chat-facebook',
  'topup',
  'account',
  'login',
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

/** Cùng cỡ icon header shop (20px) — không để SVG thiếu width/height nở full viewport. */
function chromeSvg(path: string): string {
  return `<svg class="pw-shop-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
}

const SVG: Partial<Record<VisualEditorChromeWidgetKind, string>> = {
  home: chromeSvg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/>'),
  products: chromeSvg(
    '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'
  ),
  categories: chromeSvg('<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/>'),
  search: chromeSvg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  'search-image': chromeSvg(
    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>'
  ),
  sale: chromeSvg('<path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
  wishlist: chromeSvg(
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'
  ),
  'recently-viewed': chromeSvg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  cart: chromeSvg(
    '<path d="M3 4h2l2.2 11h9.6L19 7H7"/><circle cx="10" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/>'
  ),
  chat: chromeSvg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  topup: chromeSvg('<path d="m18 15-6-6-6 6"/>'),
  orders: chromeSvg(
    '<rect x="8" y="4" width="8" height="4" rx="1"/><path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/>'
  ),
  'order-tracking': chromeSvg(
    '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'
  ),
  account: chromeSvg('<circle cx="12" cy="8" r="3.5"/><path d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5"/>'),
  addresses: chromeSvg(
    '<path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'
  ),
  wallet: chromeSvg('<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 12h.01"/><path d="M2 10h20"/>'),
  'edit-profile': chromeSvg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  notifications: chromeSvg(
    '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'
  ),
  security: chromeSvg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>'),
  'install-app': chromeSvg('<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M4 21h16"/>'),
  contact: chromeSvg('<path d="M6 4h4l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-2z"/>'),
  login: chromeSvg('<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/>'),
  about: chromeSvg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  faq: chromeSvg(
    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'
  ),
  shipping: chromeSvg(
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'
  ),
  returns: chromeSvg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  payment: chromeSvg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'),
  stores: chromeSvg('<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a3 3 0 0 0-6 0v4"/><path d="M2 7h20"/>'),
  lookbook: chromeSvg(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'
  ),
  'size-guide': chromeSvg('<path d="M21 6H3"/><path d="M18 6v12"/><path d="M6 6v12"/><path d="M3 18h18"/><path d="M10 6v3"/><path d="M14 6v3"/>'),
  blog: chromeSvg('<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>'),
  privacy: chromeSvg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  terms: chromeSvg(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>'
  ),
  'favorites-link': chromeSvg(
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'
  ),
  'orders-link': chromeSvg(
    '<rect x="8" y="4" width="8" height="4" rx="1"/><path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/>'
  ),
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
  style?: VisualEditorChromeWidgetStyle,
  place?: VisualEditorChromeWidgetPlace
): VisualEditorChromeWidgetHost {
  if (isChromeFloatKind(kind)) return 'float'
  if (place === 'nav') return 'nav'
  if (place === 'mid') return 'mid'
  if (style === 'text') return 'topbar'
  if (style === 'icon' || style === 'icon-square' || isChromeIconLabelStyle(style) || place === 'header') {
    return 'actions'
  }
  if (TOPBAR_DEFAULT_KINDS.has(kind)) return 'topbar'
  return 'actions'
}

export function chromeWidgetAppearance(
  kind: VisualEditorChromeWidgetKind,
  style?: VisualEditorChromeWidgetStyle
): VisualEditorChromeWidgetAppearance {
  if (style === 'text') return 'link'
  if (style === 'icon' || style === 'icon-square' || isChromeIconLabelStyle(style)) return 'icon'
  return chromeWidgetHost(kind) === 'topbar' ? 'link' : 'icon'
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
  if (kind === 'chat' || kind === 'chat-zalo' || kind === 'chat-facebook' || kind === 'topup') return '#'
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
  return partnerSiteNanoAiLoginHref(partnerSiteAccountPath(slug))
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
  if (kind === 'recently-viewed') return shop.navRecentlyViewed
  if (kind === 'cart') return shop.navCart
  if (kind === 'chat') return shop.navChat
  if (kind === 'chat-zalo') return shop.navChatZalo
  if (kind === 'chat-facebook') return shop.navChatFacebook
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
): kind is 'chat-zalo' | 'chat-facebook' {
  return kind === 'chat-zalo' || kind === 'chat-facebook'
}

/** Logo chính thức Zalo (màu thương hiệu Zalo, không phải --pw-*). */
export const CHROME_ZALO_LOGO_SVG =
  '<svg class="pw-chrome-brand-logo" width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" fill="#0068FF"/><path fill="#fff" d="M15 16.5h18v3.4L22.2 31.2H33.2V35H15v-3.4L25.8 19.9H15z"/></svg>'

/** Logo chính thức Facebook (màu thương hiệu Facebook, không phải --pw-*). */
export const CHROME_FACEBOOK_CHAT_LOGO_SVG =
  '<svg class="pw-chrome-brand-logo" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path fill="#fff" d="M13.2 19.2v-6.05h2.03l.3-2.35h-2.33V9.28c0-.68.19-1.15 1.17-1.15h1.25V6.02A16.4 16.4 0 0 0 13.4 5.9c-2.05 0-3.46 1.25-3.46 3.55v1.35H7.8v2.35h2.14V19.2h3.26z"/></svg>'

export function chromeContactChatLogoSvg(kind: 'chat-zalo' | 'chat-facebook'): string {
  return kind === 'chat-zalo' ? CHROME_ZALO_LOGO_SVG : CHROME_FACEBOOK_CHAT_LOGO_SVG
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
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const kind = input.kind
  const style = input.style
  const label = chromeWidgetLabel(kind, input.locale)
  const labelAttr = escapeAttr(label)
  const placeAttr = input.place ? ` data-pw-chrome-place="${input.place}"` : ''
  const sizeAttr = chromeSizeAttrs(input.iconSize)
  if (kind === 'search') {
    const shop = getPartnerSiteShopCopy(input.locale)
    const ph = escapeAttr(shop.searchPlaceholder)
    const imgLabel = escapeAttr(shop.searchByImage)
    const btnAttr = escapeAttr(shop.searchButton)
    const cameraSvg = SVG['search-image'] || ''
    const searchSvg = (SVG.search || '').replace(
      'class="pw-shop-nav-icon"',
      'class="pw-shop-nav-icon pw-shop-search-submit-icon"'
    )
    return `<div class="pw-shop-search-wrap pw-header-search" data-pw-el="search" data-pw-chrome-added="1"${placeAttr}${sizeAttr} draggable="false"><form class="pw-shop-search-form pw-search-form" data-pw-search-form role="search"><input data-pw-search type="search" name="q" placeholder="${ph}" aria-label="${ph}" autocomplete="off"/><button type="button" class="pw-shop-search-image pw-search-image-btn" data-pw-image-search aria-label="${imgLabel}" title="${imgLabel}"><span class="pw-chrome-icon-wrap">${cameraSvg}</span></button><button type="submit" class="pw-shop-search-submit pw-search-submit" aria-label="${btnAttr}">${searchSvg}<span class="pw-shop-search-submit-label">${escapeHtml(shop.searchButton)}</span></button></form></div>`
  }
  if (kind === 'search-image') {
    const svg = SVG['search-image'] || ''
    const appearance = chromeWidgetAppearance(kind, style)
    if (appearance === 'link') {
      return `<button type="button" class="pw-shop-search-image pw-search-image-btn pw-chrome-link" data-pw-image-search="1" data-pw-chrome-added="1" data-pw-chrome-style="text"${placeAttr}${sizeAttr} aria-label="${labelAttr}" title="${labelAttr}" draggable="false">${escapeHtml(label)}</button>`
    }
    const face = chromeFaceClass(style)
    const labelHtml = face.withLabel
      ? `<span class="pw-shop-nav-label pw-chrome-btn-label">${escapeHtml(label)}</span>`
      : ''
    return `<button type="button" class="pw-shop-search-image pw-search-image-btn pw-icon-btn pw-shop-icon-btn ${face.styleClass}" data-pw-image-search="1" data-pw-chrome-added="1" data-pw-chrome-style="${face.styleAttr}"${placeAttr}${sizeAttr} aria-label="${labelAttr}" title="${labelAttr}" draggable="false"><span class="pw-chrome-icon-wrap">${svg}</span>${labelHtml}</button>`
  }
  if (kind === 'categories') {
    const svg = SVG.categories || ''
    const appearance = chromeWidgetAppearance(kind, style)
    const panel = `<nav id="pw-shop-cat-panel" class="pw-shop-cat-panel pw-cat-panel" data-pw-cat-panel="1" aria-label="${labelAttr}"></nav>`
    if (appearance === 'link') {
      return `<span class="pw-chrome-cat-wrap" data-pw-chrome-added="1"${placeAttr}${sizeAttr}><button type="button" class="pw-shop-cat-btn pw-chrome-link" data-pw-el="cat-toggle" data-pw-cat-toggle="1" data-pw-chrome-style="text" aria-expanded="false" aria-controls="pw-shop-cat-panel" aria-label="${labelAttr}" title="${labelAttr}" draggable="false">${escapeHtml(label)}</button>${panel}</span>`
    }
    const face = chromeFaceClass(style)
    const labelHtml = face.withLabel
      ? `<span class="pw-shop-nav-label pw-chrome-btn-label">${escapeHtml(label)}</span>`
      : ''
    return `<span class="pw-chrome-cat-wrap" data-pw-chrome-added="1"${placeAttr}${sizeAttr}><button type="button" class="pw-shop-cat-btn pw-icon-btn pw-shop-icon-btn ${face.styleClass}" data-pw-el="cat-toggle" data-pw-cat-toggle="1" data-pw-chrome-style="${face.styleAttr}" aria-expanded="false" aria-controls="pw-shop-cat-panel" aria-label="${labelAttr}" title="${labelAttr}" draggable="false"><span class="pw-chrome-icon-wrap">${svg}</span>${labelHtml}</button>${panel}</span>`
  }
  if (kind === 'account') {
    const svg = SVG.account || ''
    const appearance = chromeWidgetAppearance(kind, style)
    const menu = getPartnerSiteAccountMenuItems({ siteSlug: slug, locale: input.locale })
      .filter((item) => !item.isHeader)
      .map((item) => {
        const classes = [item.isAccent ? 'is-accent' : ''].filter(Boolean).join(' ')
        const classAttr = classes ? ` class="${classes}"` : ''
        return `<a href="${escapeAttr(item.href)}"${classAttr} data-pw-el="menu-item">${partnerSiteAccountMenuIconSvg(item.id)}<span>${escapeHtml(item.label)}</span></a>`
      })
      .join('')
    const panel = `<nav id="pw-shop-account-panel" class="pw-shop-account-panel pw-account-panel" data-pw-account-panel="1" aria-label="${labelAttr}">${menu}</nav>`
    if (appearance === 'link') {
      return `<div class="pw-account-wrap" data-pw-chrome-added="1"${placeAttr}${sizeAttr}><button type="button" class="pw-account-btn pw-chrome-link" data-pw-el="account" data-pw-account-toggle="1" data-pw-chrome-btn="account" data-pw-chrome-style="text" aria-expanded="false" aria-controls="pw-shop-account-panel" aria-label="${labelAttr}" title="${labelAttr}" draggable="false">${escapeHtml(label)}</button>${panel}</div>`
    }
    const face = chromeFaceClass(style)
    const labelHtml = face.withLabel
      ? `<span class="pw-shop-nav-label pw-chrome-btn-label">${escapeHtml(label)}</span>`
      : ''
    return `<div class="pw-account-wrap" data-pw-chrome-added="1"${placeAttr}${sizeAttr}><button type="button" class="pw-account-btn pw-icon-btn pw-shop-icon-btn ${face.styleClass}" data-pw-el="account" data-pw-account-toggle="1" data-pw-chrome-btn="account" data-pw-chrome-style="${face.styleAttr}" aria-expanded="false" aria-controls="pw-shop-account-panel" aria-label="${labelAttr}" title="${labelAttr}" draggable="false"><span class="pw-chrome-icon-wrap">${svg}</span>${labelHtml}</button>${panel}</div>`
  }
  const isContactChat = isChromeContactChatKind(kind)
  const contactHref = isContactChat ? normalizeContactHttpUrl(input.href) : null
  const routeHref = isContactChat || isChromeFloatKind(kind) ? '' : chromeWidgetHref(kind, slug)
  const href = escapeAttr(contactHref || routeHref)
  const isChat = kind === 'chat'
  const isActionBtn = isChat || kind === 'topup'
  const floatAttr = isChromeFloatKind(kind) ? ' data-pw-chrome-float="1"' : ''
  const customChatIcon =
    isChat &&
    typeof input.chatIconLogoUrl === 'string' &&
    /^https?:\/\//i.test(input.chatIconLogoUrl.trim())
  const chatLogoSrc = customChatIcon ? input.chatIconLogoUrl : input.logoUrl
  const chatIconAttr = customChatIcon ? ' data-pw-chat-icon-logo="1"' : ''
  const chatAttr = isChat ? ' data-nanoai-open-chat' : ''
  const contactChannel = kind === 'chat-zalo' ? 'zalo' : kind === 'chat-facebook' ? 'facebook' : ''
  const contactAttr = isContactChat
    ? ` data-pw-contact-channel="${contactChannel}"${
        contactHref
          ? ' target="_blank" rel="noopener noreferrer"'
          : ' data-pw-contact-pending="1" aria-disabled="true"'
      }`
    : ''
  const openTag = isActionBtn
    ? `<button type="button" class="`
    : `<a class="`
  const closeTag = isActionBtn ? '</button>' : '</a>'
  const hrefAttr = isActionBtn || !href ? '' : ` href="${href}"`
  const countAttr = ICON_BADGE_KINDS.has(kind) ? ' data-pw-chrome-count="1"' : ''
  const elRole = kind === 'cart' ? ' data-pw-el="cart"' : ''
  if (chromeWidgetAppearance(kind, style) === 'link') {
    return `${openTag}pw-chrome-link${isChat ? ' pw-chat-open' : ''}" data-pw-chrome-btn="${kind}" data-pw-chrome-added="1" data-pw-chrome-style="text"${elRole}${placeAttr}${sizeAttr}${floatAttr}${hrefAttr}${chatAttr}${chatIconAttr}${contactAttr} draggable="false">${escapeHtml(label)}${closeTag}`
  }
  const chatLogo = isChat ? chromeChatLogoImg(chatLogoSrc) : ''
  const brandLogo = isContactChat ? chromeContactChatLogoSvg(kind) : ''
  const svg = chatLogo || brandLogo || SVG[kind] || SVG.account || ''
  const badge = ICON_BADGE_KINDS.has(kind)
    ? '<span class="pw-cart-badge pw-shop-cart-badge" data-pw-chrome-badge hidden>0</span>'
    : ''
  const face = chromeFaceClass(style)
  const labelHtml = face.withLabel
    ? `<span class="pw-shop-nav-label pw-chrome-btn-label">${escapeHtml(label)}</span>`
    : ''
  const iconHtml = `<span class="pw-chrome-icon-wrap">${svg}${badge}</span>`
  const chatClass = isChat ? ' pw-chat-open' : ''
  return `${openTag}pw-icon-btn pw-shop-icon-btn ${face.styleClass}${chatClass}" data-pw-chrome-btn="${kind}" data-pw-chrome-added="1" data-pw-chrome-style="${face.styleAttr}"${elRole}${countAttr}${placeAttr}${sizeAttr}${floatAttr}${hrefAttr}${chatAttr}${chatIconAttr}${contactAttr} aria-label="${labelAttr}" title="${labelAttr}" draggable="false">${iconHtml}${labelHtml}${closeTag}`
}
