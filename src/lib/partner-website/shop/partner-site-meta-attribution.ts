'use client'

import { metaClickSubdomainIndex, normalizeMetaFbc, normalizeMetaFbp } from '@/lib/tracking/meta-click-ids'
import {
  partnerSiteMetaAmStorageKey,
  partnerSiteMetaMatchingParams,
  pickMetaAdvancedMatching,
  type PartnerSiteMetaAdvancedMatching,
} from '@/lib/partner-website/shop/partner-site-meta-advanced-matching'

export {
  partnerSiteMetaMatchingParams,
  type PartnerSiteMetaAdvancedMatching,
} from '@/lib/partner-website/shop/partner-site-meta-advanced-matching'

declare global {
  interface Window {
    __nanoShopMetaAm?: Record<string, string>
  }
}

const COOKIE_MAX_AGE_SEC = 90 * 24 * 60 * 60
const META_CLICK_ID_MAX_AGE_MS = COOKIE_MAX_AGE_SEC * 1000
const META_CLOCK_SKEW_MS = 5 * 60 * 1000
const FBP_RE = /^fb\.\d{1,3}\.(\d{13})\.\d+$/
const FBC_RE = /^fb\.\d{1,3}\.(\d{13})\.\S+$/

function lsKey(kind: 'fbclid' | 'fbc' | 'fbp', siteSlug: string): string {
  return `pw_meta_${kind}:${siteSlug.trim().toLowerCase()}`
}

function lsGet(key: string): string {
  try {
    return (localStorage.getItem(key) || '').trim()
  } catch {
    return ''
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode */
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const hit = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  if (!hit) return null
  const v = hit.slice(name.length + 1)
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined' || typeof location === 'undefined') return
  const secure = location.protocol === 'https:' ? ';Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${COOKIE_MAX_AGE_SEC};SameSite=Lax${secure}`
}

function hasValidMetaCreationTime(value: string | null | undefined, pattern: RegExp): value is string {
  if (!value) return false
  const match = pattern.exec(value.trim())
  if (!match) return false
  const creationTimeMs = Number(match[1])
  const now = Date.now()
  return (
    Number.isSafeInteger(creationTimeMs) &&
    creationTimeMs <= now + META_CLOCK_SKEW_MS &&
    creationTimeMs >= now - META_CLICK_ID_MAX_AGE_MS
  )
}

export function isValidMetaFbp(value: string | null | undefined): value is string {
  return Boolean(normalizeMetaFbp(value) && hasValidMetaCreationTime(value, FBP_RE))
}

export function isValidMetaFbc(value: string | null | undefined): value is string {
  return Boolean(normalizeMetaFbc(value) && hasValidMetaCreationTime(value, FBC_RE))
}

function newFbp(): string {
  const idx = typeof location !== 'undefined' ? metaClickSubdomainIndex(location.hostname) : 1
  return `fb.${idx}.${Date.now()}.${Math.floor(Math.random() * 1e16)}`
}

function fbcFromFbclid(fbclid: string, existing?: string | null): string {
  const clid = fbclid.trim()
  if (existing && isValidMetaFbc(existing) && existing.endsWith(`.${clid}`)) {
    return existing
  }
  const idx = typeof location !== 'undefined' ? metaClickSubdomainIndex(location.hostname) : 1
  return `fb.${idx}.${Date.now()}.${clid}`
}

/** Persist `fbclid` → `_fbc` + scoped localStorage before Pixel init. */
export function persistPartnerSiteMetaClickIds(siteSlug: string): { fbp?: string; fbc?: string } {
  if (typeof window === 'undefined' || typeof document === 'undefined') return {}
  const slug = siteSlug.trim().toLowerCase()
  if (!slug) return {}

  const params = new URLSearchParams(window.location.search)
  const urlClid = (params.get('fbclid') || '').trim()
  if (urlClid) lsSet(lsKey('fbclid', slug), urlClid)

  const cookieFbc = readCookie('_fbc')
  const storedFbc = lsGet(lsKey('fbc', slug))
  let fbc = isValidMetaFbc(cookieFbc) ? cookieFbc : isValidMetaFbc(storedFbc) ? storedFbc : ''
  if (urlClid) {
    fbc = fbcFromFbclid(urlClid, fbc)
    writeCookie('_fbc', fbc)
    lsSet(lsKey('fbc', slug), fbc)
  } else if (fbc) {
    writeCookie('_fbc', fbc)
    lsSet(lsKey('fbc', slug), fbc)
  }

  const cookieFbp = readCookie('_fbp')
  const storedFbp = lsGet(lsKey('fbp', slug))
  const fbp = isValidMetaFbp(cookieFbp) ? cookieFbp : isValidMetaFbp(storedFbp) ? storedFbp : newFbp()
  writeCookie('_fbp', fbp)
  lsSet(lsKey('fbp', slug), fbp)

  return {
    ...(isValidMetaFbp(fbp) ? { fbp } : {}),
    ...(isValidMetaFbc(fbc) ? { fbc } : {}),
  }
}

/** Đọc `_fbc` / `_fbp` đã lưu. Không tạo id mới. */
export function readPartnerSiteMetaClickIds(siteSlug?: string | null): { fbp?: string; fbc?: string } {
  const slug = (siteSlug ?? '').trim().toLowerCase()
  const cookieFbc = readCookie('_fbc')
  const storedFbc = slug ? lsGet(lsKey('fbc', slug)) : ''
  const fbc = isValidMetaFbc(cookieFbc) ? cookieFbc : isValidMetaFbc(storedFbc) ? storedFbc : ''
  const cookieFbp = readCookie('_fbp')
  const storedFbp = slug ? lsGet(lsKey('fbp', slug)) : ''
  const fbp = isValidMetaFbp(cookieFbp) ? cookieFbp : isValidMetaFbp(storedFbp) ? storedFbp : ''
  return {
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
  }
}

const cachedMatching: Record<string, string> = {}

function readStoredMatching(siteSlug: string): Record<string, string> {
  const key = partnerSiteMetaAmStorageKey(siteSlug)
  if (!key) return {}
  try {
    return pickMetaAdvancedMatching(JSON.parse(lsGet(key) || 'null') as Record<string, unknown> | null)
  } catch {
    return {}
  }
}

function readStoredAccountId(): string {
  return (
    lsGet('app_guest_account_id') ||
    lsGet('nanoai_guest_account_id') ||
    readCookie('app_guest_account_id') ||
    readCookie('app_guest_account_sync') ||
    ''
  )
}

export type PartnerSiteMetaCustomer = {
  email?: string
  phone?: string
  externalId?: string
  matching: Record<string, string>
}

/** Nhớ dữ liệu khách (plaintext đã chuẩn hoá) để lần `fbq('init')` sau gửi so khớp nâng cao. */
export function rememberPartnerSiteMetaCustomer(
  src: PartnerSiteMetaAdvancedMatching,
  siteSlug?: string | null
): Record<string, string> {
  const params = partnerSiteMetaMatchingParams(src)
  if (!Object.keys(params).length) {
    return readPartnerSiteMetaCustomer(siteSlug).matching
  }
  Object.assign(cachedMatching, params)
  const slug = (siteSlug ?? '').trim().toLowerCase()
  if (slug) {
    const next = { ...readStoredMatching(slug), ...params }
    lsSet(partnerSiteMetaAmStorageKey(slug), JSON.stringify(next))
  }
  if (typeof window !== 'undefined') {
    window.__nanoShopMetaAm = { ...(window.__nanoShopMetaAm || {}), ...params }
  }
  return { ...cachedMatching }
}

export function readPartnerSiteMetaCustomer(siteSlug?: string | null): PartnerSiteMetaCustomer {
  const matching: Record<string, string> = {
    ...readStoredMatching(siteSlug || ''),
    ...(typeof window !== 'undefined' ? pickMetaAdvancedMatching(window.__nanoShopMetaAm) : {}),
    ...cachedMatching,
  }
  const guestId = readStoredAccountId()
  if (guestId && !matching.external_id && guestId.length >= 2 && guestId.length <= 128 && !guestId.includes('@')) {
    matching.external_id = guestId
  }
  return {
    ...(matching.em ? { email: matching.em } : {}),
    ...(matching.ph ? { phone: matching.ph } : {}),
    ...(matching.external_id ? { externalId: matching.external_id } : {}),
    matching,
  }
}
