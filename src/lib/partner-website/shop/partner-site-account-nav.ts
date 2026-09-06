import { PW_PAGE, type PwPageKind } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import type { PartnerSiteAccountMenuItemId } from '@/lib/partner-website/shop/partner-site-shop-nav-config'

/**
 * Desktop left account column — 188-style. Home / PDP / listing / landing stay full-width.
 * Login is `account` pageKind but must stay full (no nav).
 */
export function partnerSitePageShowsAccountNav(
  pageKind?: PwPageKind | null,
  opts?: { hideAccountNav?: boolean }
): boolean {
  if (opts?.hideAccountNav) return false
  return pageKind === PW_PAGE.cart || pageKind === PW_PAGE.account || pageKind === PW_PAGE.info
}

/**
 * Render the non-sensitive account shell during SSR/hydration. Mobile browsers can defer
 * hydration until the first touch; gating the whole menu on an effect leaves a frozen "…".
 */
export function shouldRenderPartnerSiteAccountShell(input: {
  authResolved: boolean
  isAuthenticated: boolean
  needsAuth: boolean
}): boolean {
  if (!input.authResolved) return true
  return input.isAuthenticated && !input.needsAuth
}

/** Strip `/site/{slug}` so custom-domain `/cart` and platform `/site/x/cart` match the same item. */
export function normalizePartnerSitePathname(pathname: string): string {
  const raw = String(pathname || '/').split(/[?#]/)[0] || '/'
  const stripped = raw.replace(/^\/site\/[^/]+(?=\/|$)/, '')
  const path = stripped.startsWith('/') ? stripped : `/${stripped}`
  return path.replace(/\/+$/, '') || '/'
}

/** Cart / account / login React layout — page chrome flags from the URL, not a remounted shell. */
export function reactAccountShellNavFromPathname(pathname: string): {
  pageKind: PwPageKind
  activeNav: 'cart' | 'account'
  hideAccountNav: boolean
} {
  const path = normalizePartnerSitePathname(pathname)
  if (path === '/login' || path.startsWith('/login/')) {
    return { pageKind: PW_PAGE.account, activeNav: 'account', hideAccountNav: true }
  }
  if (path === '/cart' || path.startsWith('/cart/')) {
    return { pageKind: PW_PAGE.cart, activeNav: 'cart', hideAccountNav: false }
  }
  return { pageKind: PW_PAGE.account, activeNav: 'account', hideAccountNav: false }
}

export function partnerSiteAccountNavActiveId(pathname: string): PartnerSiteAccountMenuItemId | null {
  const path = normalizePartnerSitePathname(pathname)
  if (path === '/cart' || path.startsWith('/cart/') || path === '/account/cart') return 'cart'
  if (path.startsWith('/orders') || path === '/account/orders') return 'orders'
  if (path === '/wishlist' || path === '/account/wishlist') return 'wishlist'
  if (path === '/recently-viewed' || path === '/account/recently-viewed') return 'recently-viewed'
  if (path === '/addresses' || path === '/account/addresses') return 'addresses'
  if (path === '/account/edit-profile' || path === '/account/profile') return 'edit-profile'
  if (path === '/account/wallet' || path === '/account/khuyen-mai') return 'wallet'
  if (path === '/account/security' || path === '/account/change-password') return 'security'
  if (path === '/account/notifications') return 'notifications'
  if (path === '/account/install-app') return 'install-app'
  if (path === '/account/contact' || path === '/contact') return 'contact'
  if (path === '/account' || path === '/login') return 'account'
  return null
}
