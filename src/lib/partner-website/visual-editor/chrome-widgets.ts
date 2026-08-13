import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteCategoryNavLabels } from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteAccountPath,
  partnerSiteAddressesPath,
  partnerSiteCartPath,
  partnerSiteInfoPath,
  partnerSiteNanoAiLoginHref,
  partnerSiteOrdersPath,
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

export const VISUAL_EDITOR_CHROME_WIDGET_KINDS = [
  'wishlist',
  'recently-viewed',
  'cart',
  'orders',
  'account',
  'addresses',
  'contact',
  'login',
  'favorites-link',
  'orders-link',
] as const

export type VisualEditorChromeWidgetKind = (typeof VISUAL_EDITOR_CHROME_WIDGET_KINDS)[number]

export type VisualEditorChromeWidgetHost = 'actions' | 'topbar'

export type VisualEditorChromeWidgetAppearance = 'icon' | 'link'

const SVG: Partial<Record<VisualEditorChromeWidgetKind, string>> = {
  wishlist:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12.6 12 20l-7.5-7.4A4.5 4.5 0 0 1 12 6.5a4.5 4.5 0 0 1 7.5 6.1z"/></svg>',
  'recently-viewed':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11h9.6L19 7H7"/><circle cx="10" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/></svg>',
  orders:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="4" width="8" height="4" rx="1"/><path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>',
  account:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5"/></svg>',
  addresses:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
}

const ICON_BADGE_KINDS = new Set<VisualEditorChromeWidgetKind>([
  'wishlist',
  'recently-viewed',
  'cart',
])

export function isVisualEditorChromeWidgetKind(value: string): value is VisualEditorChromeWidgetKind {
  return (VISUAL_EDITOR_CHROME_WIDGET_KINDS as readonly string[]).includes(value)
}

export function chromeWidgetHost(kind: VisualEditorChromeWidgetKind): VisualEditorChromeWidgetHost {
  if (
    kind === 'contact' ||
    kind === 'login' ||
    kind === 'favorites-link' ||
    kind === 'orders-link'
  ) {
    return 'topbar'
  }
  return 'actions'
}

export function chromeWidgetAppearance(
  kind: VisualEditorChromeWidgetKind
): VisualEditorChromeWidgetAppearance {
  return chromeWidgetHost(kind) === 'topbar' ? 'link' : 'icon'
}

export function chromeWidgetHref(kind: VisualEditorChromeWidgetKind, siteSlug: string): string {
  const slug = siteSlug.trim()
  if (kind === 'wishlist' || kind === 'favorites-link') return partnerSiteWishlistPath(slug)
  if (kind === 'recently-viewed') return partnerSiteRecentlyViewedPath(slug)
  if (kind === 'cart') return partnerSiteCartPath(slug)
  if (kind === 'orders' || kind === 'orders-link') return partnerSiteOrdersPath(slug)
  if (kind === 'account') return partnerSiteAccountPath(slug)
  if (kind === 'addresses') return partnerSiteAddressesPath(slug)
  if (kind === 'contact') return partnerSiteInfoPath(slug, 'contact')
  return partnerSiteNanoAiLoginHref(partnerSiteAccountPath(slug))
}

export function chromeWidgetLabel(kind: VisualEditorChromeWidgetKind, locale: WebLocale): string {
  const shop = getPartnerSiteShopCopy(locale)
  const nav = getPartnerSiteCategoryNavLabels(locale)
  if (kind === 'wishlist' || kind === 'favorites-link') return shop.navFavorites
  if (kind === 'recently-viewed') return shop.navRecentlyViewed
  if (kind === 'cart') return shop.navCart
  if (kind === 'orders' || kind === 'orders-link') return shop.navOrders
  if (kind === 'account') return shop.navAccount
  if (kind === 'addresses') return shop.accountAddressBook
  if (kind === 'contact') return nav.contact
  return nav.login
}

/** Icon / topbar link wired to shop routes + badge APIs (`data-pw-chrome-btn`). */
export function buildVisualEditorChromeWidgetHtml(input: {
  kind: VisualEditorChromeWidgetKind
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const kind = input.kind
  const href = escapeAttr(chromeWidgetHref(kind, slug))
  const label = chromeWidgetLabel(kind, input.locale)
  const labelAttr = escapeAttr(label)
  if (chromeWidgetAppearance(kind) === 'link') {
    return `<a class="pw-chrome-link" data-pw-chrome-btn="${kind}" data-pw-chrome-added="1" href="${href}" draggable="false">${escapeHtml(label)}</a>`
  }
  const svg = SVG[kind] || SVG.account || ''
  const badge = ICON_BADGE_KINDS.has(kind)
    ? '<span class="pw-cart-badge" data-pw-chrome-badge hidden>0</span>'
    : ''
  return `<a class="pw-icon-btn" data-pw-chrome-btn="${kind}" data-pw-chrome-added="1" href="${href}" aria-label="${labelAttr}" title="${labelAttr}" draggable="false">${svg}${badge}</a>`
}
