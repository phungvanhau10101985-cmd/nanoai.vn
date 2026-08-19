import crypto from 'node:crypto'
import { getPrimaryAuthJwtSecretBytes } from '@/lib/auth/email-auth-config'
import { fetchPartnerExternalShopSsoPg } from '@/lib/db/messaging-partners-pg'
import {
  fetchPartnerShopSiteCustomDomainOriginPg,
  resolveActivePartnerCustomDomainByHostPg,
} from '@/lib/db/messaging-partner-custom-domains-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { hostnameFromOrigin, normalizePartnerShopOrigin } from '@/lib/partner-website/shop/partner-site-shop-sso'

export {
  buildShopGoogleAuthBridgeUrl,
  PARTNER_SITE_GOOGLE_AUTH_HANDOFF_QUERY_KEY,
} from '@/lib/partner-website/shop/partner-site-google-auth-handoff-client'

const HANDOFF_MAX_TTL_SEC = 600
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type PartnerSiteGoogleAuthHandoffPayload = {
  v: 1
  email: string
  siteSlug: string
  partnerId: string
  path: string
  exp: number
  authUserId?: string
}

function handoffSecret(): Buffer | null {
  const raw = getPrimaryAuthJwtSecretBytes()
  return raw ? Buffer.from(raw) : null
}

function signHandoffBody(body: string, secret: Buffer): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url')
}

export function issuePartnerSiteGoogleAuthHandoff(input: {
  email: string
  siteSlug: string
  partnerId: string
  /** Path on shop public URL, e.g. `/account`. */
  path: string
  authUserId?: string
  ttlSec?: number
}): string {
  const secret = handoffSecret()
  if (!secret) throw new Error('handoff_secret_missing')
  const email = input.email.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new Error('handoff_invalid_email')
  const siteSlug = input.siteSlug.trim().toLowerCase()
  const partnerId = input.partnerId.trim()
  if (!siteSlug || !partnerId) throw new Error('handoff_invalid_shop')
  const pathRaw = input.path.trim() || '/account'
  const path = pathRaw.startsWith('/') && !pathRaw.startsWith('//') ? pathRaw.split('#')[0] : '/account'
  const ttl = Math.min(HANDOFF_MAX_TTL_SEC, Math.max(60, input.ttlSec ?? 300))
  const authUserId = input.authUserId?.trim() || ''
  const payload: PartnerSiteGoogleAuthHandoffPayload = {
    v: 1,
    email,
    siteSlug,
    partnerId,
    path,
    exp: Math.floor(Date.now() / 1000) + ttl,
    ...(authUserId ? { authUserId } : {}),
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = signHandoffBody(body, secret)
  return `${body}.${sig}`
}

export function verifyPartnerSiteGoogleAuthHandoff(
  tokenRaw: string
): { ok: true; payload: PartnerSiteGoogleAuthHandoffPayload } | { ok: false; error: string } {
  const secret = handoffSecret()
  if (!secret) return { ok: false, error: 'HANDOFF_SECRET' }
  const raw = tokenRaw.trim()
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return { ok: false, error: 'INVALID_TOKEN' }
  const body = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const expected = signHandoffBody(body, secret)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(sig, 'utf8')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'INVALID_TOKEN' }
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<PartnerSiteGoogleAuthHandoffPayload>
    if (parsed.v !== 1) return { ok: false, error: 'INVALID_TOKEN' }
    const email = String(parsed.email ?? '').trim().toLowerCase()
    const siteSlug = String(parsed.siteSlug ?? '').trim().toLowerCase()
    const partnerId = String(parsed.partnerId ?? '').trim()
    const path = String(parsed.path ?? '/account').trim() || '/account'
    const exp = Number(parsed.exp)
    if (!EMAIL_RE.test(email) || !siteSlug || !partnerId || !Number.isFinite(exp)) {
      return { ok: false, error: 'INVALID_TOKEN' }
    }
    if (exp < Math.floor(Date.now() / 1000)) return { ok: false, error: 'TOKEN_EXPIRED' }
    if (exp - Math.floor(Date.now() / 1000) > HANDOFF_MAX_TTL_SEC) {
      return { ok: false, error: 'INVALID_TOKEN' }
    }
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
      return { ok: false, error: 'INVALID_TOKEN' }
    }
    const authUserId = String(parsed.authUserId ?? '').trim()
    return {
      ok: true,
      payload: {
        v: 1,
        email,
        siteSlug,
        partnerId,
        path,
        exp: Math.floor(exp),
        ...(authUserId ? { authUserId } : {}),
      },
    }
  } catch {
    return { ok: false, error: 'INVALID_TOKEN' }
  }
}

export type VerifiedShopReturnUrl = {
  origin: string
  hostname: string
  pathname: string
  search: string
  href: string
  siteSlug: string
  partnerId: string
  partnerSlug: string
}

/**
 * Chỉ cho phép quay về hostname đã verify trong quản trị (custom domain shop)
 * hoặc external_shop_origin khớp cùng partner có website.
 */
export async function resolveVerifiedPartnerShopReturnUrl(
  raw: string
): Promise<VerifiedShopReturnUrl | null> {
  if (!isPgConfigured()) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  // Production shop domains must be https; allow http only for local-style hosts.
  const host = url.hostname.toLowerCase()
  if (url.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/i.test(host) && !host.endsWith('.localhost')) {
    return null
  }
  if (url.username || url.password) return null

  const byHost = await resolveActivePartnerCustomDomainByHostPg(host)
  if (byHost?.use_for_site && byHost.site_slug?.trim()) {
    const origin = `${url.protocol}//${url.host}`.replace(/\/$/, '')
    const pathname = url.pathname || '/'
    return {
      origin,
      hostname: host,
      pathname,
      search: url.search || '',
      href: `${origin}${pathname}${url.search || ''}`,
      siteSlug: byHost.site_slug.trim().toLowerCase(),
      partnerId: byHost.partner_id,
      partnerSlug: byHost.partner_slug,
    }
  }

  return null
}

/** Validate return URL against a known partnerId/siteSlug (from form next=/site/{slug}/…). */
export async function resolveVerifiedPartnerShopReturnUrlForSite(input: {
  rawReturnUrl: string
  siteSlug: string
  partnerId: string
}): Promise<VerifiedShopReturnUrl | null> {
  const base = await resolveVerifiedPartnerShopReturnUrl(input.rawReturnUrl)
  if (base) {
    if (base.siteSlug !== input.siteSlug.trim().toLowerCase()) return null
    if (base.partnerId !== input.partnerId.trim()) return null
    return base
  }

  if (!isPgConfigured()) return null
  let url: URL
  try {
    url = new URL(input.rawReturnUrl.trim())
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  const allowedOrigins = new Set<string>()
  const siteOrigin = await fetchPartnerShopSiteCustomDomainOriginPg(input.partnerId)
  if (siteOrigin) {
    const n = normalizePartnerShopOrigin(siteOrigin)
    if (n) allowedOrigins.add(n.toLowerCase())
  }
  const sso = await fetchPartnerExternalShopSsoPg(input.partnerId)
  if (sso?.external_shop_origin) {
    const n = normalizePartnerShopOrigin(sso.external_shop_origin)
    if (n) allowedOrigins.add(n.toLowerCase())
  }
  const requestOrigin = `${url.protocol}//${url.host}`.replace(/\/$/, '').toLowerCase()
  if (![...allowedOrigins].some((o) => o === requestOrigin || hostnameFromOrigin(o) === host)) {
    return null
  }
  const origin = `${url.protocol}//${url.host}`.replace(/\/$/, '')
  const pathname = url.pathname || '/'
  return {
    origin,
    hostname: host,
    pathname,
    search: url.search || '',
    href: `${origin}${pathname}${url.search || ''}`,
    siteSlug: input.siteSlug.trim().toLowerCase(),
    partnerId: input.partnerId.trim(),
    partnerSlug: '',
  }
}

