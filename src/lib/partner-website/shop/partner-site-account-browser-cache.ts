/**
 * Browser cache for logged-in shop account surfaces.
 * Stale-while-revalidate: paint immediately, refresh from API in the background.
 */

import {
  MESSAGING_GUEST_ACCOUNT_STORAGE_KEY,
  MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY,
  MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE,
} from '@/lib/messaging/guest-account-session'
import { shopCustomerLoginLabel } from '@/lib/partner-website/shop/partner-site-login-identity'
import { parsePartnerShopGender } from '@/lib/partner-website/shop/partner-site-profile-demographics'
import { shouldPartnerSiteShopSkipAuthSync } from '@/lib/partner-website/shop/partner-site-shop-auth-skip-sync'

export const PW_ACCOUNT_BROWSER_CACHE_VERSION = 1
export const PW_ACCOUNT_BROWSER_CACHE_KEY_PREFIX = 'pw-account-cache-v1:'
export const PW_ACCOUNT_BROWSER_CACHE_CHANGE_EVENT = 'pw-partner-site-account-cache-change'
export const PW_ACCOUNT_BROWSER_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const PW_ACCOUNT_BROWSER_CACHE_MAX_ORDERS = 40
export const PW_ACCOUNT_BROWSER_CACHE_MAX_ADDRESSES = 20
export const PW_ACCOUNT_BROWSER_CACHE_MAX_WALLET = 40
export const PW_ACCOUNT_BROWSER_CACHE_MAX_NOTIFICATIONS = 30
const MAX_JSON_CHARS = 180_000

export type PartnerSiteCachedAccountProfile = {
  email: string | null
  greeting_name: string | null
  customer_name: string | null
  customer_phone: string | null
  shipping_address: string | null
  gender: 'male' | 'female' | null
  date_of_birth: string | null
  avatar_url: string | null
  auth_mode: 'anonymous' | 'guest_account' | 'linked_user'
}

export type PartnerSiteCachedAddress = {
  id: string
  full_name: string
  phone: string
  province: string
  district: string
  ward: string
  street_address: string
  is_default: boolean
}

export type PartnerSiteCachedOrder = {
  id: string
  status?: string | null
  shipping_status?: string | null
  has_review?: boolean | null
  product_name?: string | null
  product_image_url?: string | null
  product_inventory_id?: string | null
  required_amount?: number | null
  subtotal_amount?: number | null
  paid_amount?: number | null
  quantity?: number | null
  payment_reference?: string | null
  created_at?: string | null
  can_cancel?: boolean | null
  can_confirm_received?: boolean | null
  tracking_number?: string | null
}

export type PartnerSiteCachedWalletVoucher = {
  code: string
  name?: string
  description?: string
  discountType?: 'percent' | 'fixed_amount'
  discountPercent?: number | null
  discountAmount?: number | null
  maxDiscountAmount?: number | null
  minSubtotal?: number
  expiresAt?: string | null
  eligible?: boolean
  ineligibleReason?: string | null
}

export type PartnerSiteCachedNotification = {
  id: string
  type?: string
  title: string
  body?: string
  href?: string
  readAt?: string | null
  createdAt?: string
}

export type PartnerSiteAccountBrowserCache = {
  v: typeof PW_ACCOUNT_BROWSER_CACHE_VERSION
  accountId: string
  savedAt: number
  profile: PartnerSiteCachedAccountProfile | null
  shopAdminHref: string | null
  orders: PartnerSiteCachedOrder[]
  wallet: PartnerSiteCachedWalletVoucher[]
  addresses: PartnerSiteCachedAddress[]
  unreadNotifications: number
  notifications: PartnerSiteCachedNotification[]
}

export type PartnerSiteAccountBrowserCachePatch = {
  profile?: unknown
  shopAdminHref?: string | null
  orders?: unknown[]
  wallet?: unknown[]
  addresses?: unknown[]
  unreadNotifications?: number
  notifications?: unknown[]
}

function emptyCache(accountId: string): PartnerSiteAccountBrowserCache {
  return {
    v: PW_ACCOUNT_BROWSER_CACHE_VERSION,
    accountId,
    savedAt: 0,
    profile: null,
    shopAdminHref: null,
    orders: [],
    wallet: [],
    addresses: [],
    unreadNotifications: 0,
    notifications: [],
  }
}

function readCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return ''
}

export function partnerSiteAccountBrowserCacheKey(siteSlug: string): string {
  return `${PW_ACCOUNT_BROWSER_CACHE_KEY_PREFIX}${siteSlug.trim().toLowerCase()}`
}

export function readPartnerSiteStoredAccountId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const fromLs =
      window.localStorage.getItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY)?.trim() ||
      window.localStorage.getItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY)?.trim() ||
      ''
    if (fromLs) return fromLs
  } catch {
    /* ignore */
  }
  return readCookie(MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE).trim()
}

function clip(raw: unknown, max: number): string {
  return String(raw ?? '').trim().slice(0, max)
}

function clipOrNull(raw: unknown, max: number): string | null {
  const t = clip(raw, max)
  return t || null
}

function numOrNull(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

export function sanitizePartnerSiteCachedAccountProfile(raw: unknown): PartnerSiteCachedAccountProfile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const auth = String(o.auth_mode ?? '').trim()
  const auth_mode: PartnerSiteCachedAccountProfile['auth_mode'] =
    auth === 'linked_user' || auth === 'anonymous' || auth === 'guest_account' ? auth : 'guest_account'
  const profile: PartnerSiteCachedAccountProfile = {
    email: clipOrNull(o.email, 254),
    greeting_name: clipOrNull(o.greeting_name, 80),
    customer_name: clipOrNull(o.customer_name, 80),
    customer_phone: clipOrNull(o.customer_phone, 32),
    shipping_address: clipOrNull(o.shipping_address, 500),
    gender: parsePartnerShopGender(o.gender),
    date_of_birth: clipOrNull(o.date_of_birth, 10),
    avatar_url: clipOrNull(o.avatar_url, 2000),
    auth_mode,
  }
  if (
    !profile.email &&
    !profile.customer_name &&
    !profile.greeting_name &&
    !profile.customer_phone &&
    !profile.avatar_url
  ) {
    return null
  }
  return profile
}

function definedRecord<T extends Record<string, unknown>>(row: T): T {
  const next = { ...row }
  for (const key of Object.keys(next)) {
    if (next[key] === undefined) delete next[key]
  }
  return next
}

function sanitizeOrder(raw: unknown): PartnerSiteCachedOrder | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const id = clip(o.id, 80)
  if (!id) return null
  return definedRecord({
    id,
    status: clipOrNull(o.status, 40),
    shipping_status: clipOrNull(o.shipping_status, 40),
    has_review: typeof o.has_review === 'boolean' ? o.has_review : o.has_review == null ? null : Boolean(o.has_review),
    product_name: clipOrNull(o.product_name, 200),
    product_image_url: clipOrNull(o.product_image_url, 2000),
    product_inventory_id: clipOrNull(o.product_inventory_id, 80),
    required_amount: numOrNull(o.required_amount),
    subtotal_amount: numOrNull(o.subtotal_amount),
    paid_amount: numOrNull(o.paid_amount),
    quantity: numOrNull(o.quantity),
    payment_reference: clipOrNull(o.payment_reference, 40),
    created_at: clipOrNull(o.created_at, 40),
    can_cancel: typeof o.can_cancel === 'boolean' ? o.can_cancel : undefined,
    can_confirm_received: typeof o.can_confirm_received === 'boolean' ? o.can_confirm_received : undefined,
    tracking_number: clipOrNull(o.tracking_number, 80),
  })
}

function mergeOrderRow(old: PartnerSiteCachedOrder | undefined, row: PartnerSiteCachedOrder): PartnerSiteCachedOrder {
  if (!old) return row
  return {
    ...old,
    ...row,
    product_name: row.product_name || old.product_name,
    product_image_url: row.product_image_url || old.product_image_url,
    product_inventory_id: row.product_inventory_id || old.product_inventory_id,
    payment_reference: row.payment_reference || old.payment_reference,
    tracking_number: row.tracking_number || old.tracking_number,
    created_at: row.created_at || old.created_at,
  }
}

function mergeOrders(
  prev: PartnerSiteCachedOrder[],
  next: PartnerSiteCachedOrder[],
  replaceList: boolean
): PartnerSiteCachedOrder[] {
  if (replaceList) return next.slice(0, PW_ACCOUNT_BROWSER_CACHE_MAX_ORDERS)
  const byId = new Map<string, PartnerSiteCachedOrder>()
  for (const row of prev) byId.set(row.id, row)
  for (const row of next) byId.set(row.id, mergeOrderRow(byId.get(row.id), row))
  const merged = next
    .map((row) => byId.get(row.id))
    .filter((row): row is PartnerSiteCachedOrder => Boolean(row))
  for (const row of prev) {
    if (!merged.some((item) => item.id === row.id)) merged.push(row)
  }
  return merged.slice(0, PW_ACCOUNT_BROWSER_CACHE_MAX_ORDERS)
}

function sanitizeAddress(raw: unknown): PartnerSiteCachedAddress | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const id = clip(o.id, 80)
  const full_name = clip(o.full_name, 80)
  const phone = clip(o.phone, 32)
  if (!id || !full_name || !phone) return null
  return {
    id,
    full_name,
    phone,
    province: clip(o.province, 80),
    district: clip(o.district, 80),
    ward: clip(o.ward, 80),
    street_address: clip(o.street_address, 500),
    is_default: o.is_default === true,
  }
}

function sanitizeWallet(raw: unknown): PartnerSiteCachedWalletVoucher | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const code = clip(o.code, 40)
  if (!code) return null
  const discountType = o.discountType === 'percent' || o.discountType === 'fixed_amount' ? o.discountType : undefined
  return definedRecord({
    code,
    name: clip(o.name, 120) || undefined,
    description: clip(o.description, 240) || undefined,
    discountType,
    discountPercent: numOrNull(o.discountPercent),
    discountAmount: numOrNull(o.discountAmount),
    maxDiscountAmount: numOrNull(o.maxDiscountAmount),
    minSubtotal: numOrNull(o.minSubtotal) ?? undefined,
    expiresAt: clipOrNull(o.expiresAt, 40),
    eligible: typeof o.eligible === 'boolean' ? o.eligible : undefined,
    ineligibleReason: clipOrNull(o.ineligibleReason, 80),
  })
}

function sanitizeNotification(raw: unknown): PartnerSiteCachedNotification | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const id = clip(o.id, 80)
  const title = clip(o.title, 160)
  if (!id || !title) return null
  return definedRecord({
    id,
    type: clip(o.type, 40) || undefined,
    title,
    body: clip(o.body, 400) || undefined,
    href: clip(o.href, 400) || undefined,
    readAt: clipOrNull(o.readAt, 40),
    createdAt: clip(o.createdAt, 40) || undefined,
  })
}

function parseCache(raw: string | null): PartnerSiteAccountBrowserCache | null {
  if (!raw) return null
  try {
    const json = JSON.parse(raw) as Partial<PartnerSiteAccountBrowserCache>
    if (!json || json.v !== PW_ACCOUNT_BROWSER_CACHE_VERSION) return null
    const accountId = String(json.accountId ?? '').trim()
    if (!accountId) return null
    const savedAt = Number(json.savedAt) || 0
    if (savedAt > 0 && Date.now() - savedAt > PW_ACCOUNT_BROWSER_CACHE_TTL_MS) return null
    return {
      ...emptyCache(accountId),
      accountId,
      savedAt,
      profile: sanitizePartnerSiteCachedAccountProfile(json.profile),
      shopAdminHref: clipOrNull(json.shopAdminHref, 400),
      orders: Array.isArray(json.orders)
        ? json.orders.map(sanitizeOrder).filter((row): row is PartnerSiteCachedOrder => Boolean(row))
        : [],
      wallet: Array.isArray(json.wallet)
        ? json.wallet.map(sanitizeWallet).filter((row): row is PartnerSiteCachedWalletVoucher => Boolean(row))
        : [],
      addresses: Array.isArray(json.addresses)
        ? json.addresses.map(sanitizeAddress).filter((row): row is PartnerSiteCachedAddress => Boolean(row))
        : [],
      unreadNotifications: Math.max(0, Number(json.unreadNotifications ?? 0) || 0),
      notifications: Array.isArray(json.notifications)
        ? json.notifications
            .map(sanitizeNotification)
            .filter((row): row is PartnerSiteCachedNotification => Boolean(row))
        : [],
    }
  } catch {
    return null
  }
}

export function readPartnerSiteAccountBrowserCache(siteSlug: string): PartnerSiteAccountBrowserCache | null {
  if (typeof window === 'undefined') return null
  const slug = siteSlug.trim()
  if (!slug) return null
  if (shouldPartnerSiteShopSkipAuthSync(slug)) return null
  const accountId = readPartnerSiteStoredAccountId()
  if (!accountId) return null
  try {
    const parsed = parseCache(window.localStorage.getItem(partnerSiteAccountBrowserCacheKey(slug)))
    if (!parsed || parsed.accountId !== accountId) return null
    return parsed
  } catch {
    return null
  }
}

function notifyCacheChange(siteSlug: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(PW_ACCOUNT_BROWSER_CACHE_CHANGE_EVENT, {
      detail: { siteSlug: siteSlug.trim().toLowerCase() },
    })
  )
}

export function writePartnerSiteAccountBrowserCache(
  siteSlug: string,
  patch: PartnerSiteAccountBrowserCachePatch
): PartnerSiteAccountBrowserCache | null {
  if (typeof window === 'undefined') return null
  const slug = siteSlug.trim()
  if (!slug) return null
  if (shouldPartnerSiteShopSkipAuthSync(slug)) return null
  const accountId = readPartnerSiteStoredAccountId()
  if (!accountId) return null
  const prev = readPartnerSiteAccountBrowserCache(slug) || emptyCache(accountId)
  const next: PartnerSiteAccountBrowserCache = {
    ...prev,
    v: PW_ACCOUNT_BROWSER_CACHE_VERSION,
    accountId,
    savedAt: Date.now(),
  }
  if ('profile' in patch) {
    if (patch.profile == null) {
      next.profile = null
    } else {
      const incoming =
        patch.profile && typeof patch.profile === 'object' && !Array.isArray(patch.profile)
          ? (patch.profile as Record<string, unknown>)
          : {}
      next.profile = sanitizePartnerSiteCachedAccountProfile({
        ...(prev.profile || {}),
        ...incoming,
      })
    }
  }
  if ('shopAdminHref' in patch) next.shopAdminHref = clipOrNull(patch.shopAdminHref, 400)
  if (Array.isArray(patch.orders)) {
    const sanitized = patch.orders.map(sanitizeOrder).filter((row): row is PartnerSiteCachedOrder => Boolean(row))
    if (sanitized.length) {
      const replaceList = sanitized.some(
        (row) => row.product_name || row.product_image_url || row.payment_reference
      )
      next.orders = mergeOrders(prev.orders, sanitized, replaceList)
    }
  }
  if (patch.wallet) {
    next.wallet = patch.wallet
      .map(sanitizeWallet)
      .filter((row): row is PartnerSiteCachedWalletVoucher => Boolean(row))
      .slice(0, PW_ACCOUNT_BROWSER_CACHE_MAX_WALLET)
  }
  if (patch.addresses) {
    next.addresses = patch.addresses
      .map(sanitizeAddress)
      .filter((row): row is PartnerSiteCachedAddress => Boolean(row))
      .slice(0, PW_ACCOUNT_BROWSER_CACHE_MAX_ADDRESSES)
  }
  if (typeof patch.unreadNotifications === 'number') {
    next.unreadNotifications = Math.max(0, Number(patch.unreadNotifications) || 0)
  }
  if (patch.notifications) {
    next.notifications = patch.notifications
      .map(sanitizeNotification)
      .filter((row): row is PartnerSiteCachedNotification => Boolean(row))
      .slice(0, PW_ACCOUNT_BROWSER_CACHE_MAX_NOTIFICATIONS)
  }
  try {
    let payload = JSON.stringify(next)
    if (payload.length > MAX_JSON_CHARS && next.notifications.length) {
      next.notifications = []
      payload = JSON.stringify(next)
    }
    if (payload.length > MAX_JSON_CHARS && next.orders.length > 8) {
      next.orders = next.orders.slice(0, 8)
      payload = JSON.stringify(next)
    }
    window.localStorage.setItem(partnerSiteAccountBrowserCacheKey(slug), payload)
    notifyCacheChange(slug)
    return next
  } catch {
    return null
  }
}

export function clearPartnerSiteAccountBrowserCache(siteSlug: string): void {
  if (typeof window === 'undefined') return
  const slug = siteSlug.trim()
  if (!slug) return
  try {
    window.localStorage.removeItem(partnerSiteAccountBrowserCacheKey(slug))
  } catch {
    /* ignore */
  }
  notifyCacheChange(slug)
}

export function loginIdentityFromAccountCache(cache: PartnerSiteAccountBrowserCache | null): {
  name: string
  avatarUrl: string | null
} | null {
  const profile = cache?.profile
  if (!profile) return null
  const name = shopCustomerLoginLabel({
    customerName: profile.customer_name,
    profileName: profile.greeting_name,
    email: profile.email,
  })
  const avatar = String(profile.avatar_url ?? '').trim()
  const avatarUrl = /^https?:\/\//i.test(avatar) ? avatar : null
  if (!name && !avatarUrl) return null
  return { name, avatarUrl }
}
