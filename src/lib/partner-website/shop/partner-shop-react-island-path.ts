/**
 * React islands keep App Router `router.push`. Visual HTML pages hard-navigate
 * after first paint already has product cards.
 */

const REACT_ISLAND_ROOTS = new Set([
  'cart',
  'orders',
  'account',
  'login',
  'addresses',
  'wishlist',
  'recently-viewed',
  'search',
  'tim-kiem',
  'tim-theo-anh',
  'thanh-vien',
  'vi-dien-tu',
  'tai-khoan-ngan-hang',
])

export function stripPartnerSitePrefix(pathname: string): string {
  const raw = String(pathname || '').split('?')[0] || '/'
  const trimmed = raw.length > 1 ? raw.replace(/\/+$/, '') : raw || '/'
  return trimmed.replace(/^\/site\/[^/]+/i, '') || '/'
}

export function isPartnerShopReactIslandPath(pathname: string): boolean {
  const path = stripPartnerSitePrefix(pathname)
  if (path === '/') return false
  const root = path.split('/').filter(Boolean)[0]?.toLowerCase() || ''
  if (REACT_ISLAND_ROOTS.has(root)) return true
  if (root === 'products' && /\/cart\/add\//i.test(path)) return true
  return false
}

export function isPartnerShopVisualHtmlPath(pathname: string): boolean {
  return !isPartnerShopReactIslandPath(pathname)
}
