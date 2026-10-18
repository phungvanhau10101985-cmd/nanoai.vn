'use client'

import { metaClickSubdomainIndex, normalizeMetaFbc, normalizeMetaFbp } from '@/lib/tracking/meta-click-ids'

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

const cachedCustomer: { email?: string; phone?: string; externalId?: string } = {}

function readStoredAccountId(): string {
  return (
    lsGet('app_guest_account_id') ||
    lsGet('nanoai_guest_account_id') ||
    readCookie('app_guest_account_id') ||
    readCookie('app_guest_account_sync') ||
    lsGet('app_guest_session_id') ||
    lsGet('nanoai_guest_session_id') ||
    readCookie('app_guest_session_id') ||
    ''
  )
}

/** Nhớ email / SĐT / ID khách để mọi sự kiện CAPI sau đó gửi kèm. */
export function rememberPartnerSiteMetaCustomer(src: PartnerSiteMetaAdvancedMatching): void {
  const email = (src.email || '').trim().toLowerCase()
  const phone = (src.phone || '').trim()
  const externalId = String(src.externalId ?? '').trim()
  if (email.includes('@')) cachedCustomer.email = email
  if (phone) cachedCustomer.phone = phone
  if (externalId) cachedCustomer.externalId = externalId
}

export function readPartnerSiteMetaCustomer(): { email?: string; phone?: string; externalId?: string } {
  const externalId = cachedCustomer.externalId || readStoredAccountId()
  return {
    ...(cachedCustomer.email ? { email: cachedCustomer.email } : {}),
    ...(cachedCustomer.phone ? { phone: cachedCustomer.phone } : {}),
    ...(externalId ? { externalId } : {}),
  }
}

export type PartnerSiteMetaAdvancedMatching = {
  email?: string | null
  phone?: string | null
  fullName?: string | null
  externalId?: string | null
}

function foldMetaText(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitVnName(fullName: string): { fn?: string; ln?: string } {
  const folded = foldMetaText(fullName)
  if (!folded) return {}
  const parts = folded.split(' ')
  if (parts.length === 1) return { fn: parts[0] }
  return { ln: parts[0], fn: parts.slice(1).join(' ') }
}

function normalizePhoneVn(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return undefined
  if (digits.startsWith('0')) return `84${digits.slice(1)}`
  if (!digits.startsWith('84')) return `84${digits}`
  return digits
}

export function partnerSiteMetaMatchingParams(
  src: PartnerSiteMetaAdvancedMatching
): Record<string, string> {
  const out: Record<string, string> = {}
  const email = (src.email || '').trim().toLowerCase()
  if (email.includes('@')) out.em = email
  const phone = normalizePhoneVn(src.phone || '')
  if (phone) out.ph = phone
  const names = splitVnName(src.fullName || '')
  if (names.fn) out.fn = names.fn
  if (names.ln) out.ln = names.ln
  if (src.externalId != null && String(src.externalId).trim()) {
    out.external_id = String(src.externalId).trim()
  }
  return out
}
