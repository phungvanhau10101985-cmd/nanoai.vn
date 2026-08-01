import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'

const SITE_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

const RESERVED_SITE_SLUGS = new Set([
  'site',
  'share',
  'api',
  'dashboard',
  'admin',
  'messaging',
  'hospitality',
  'auth',
  'login',
  'signup',
  'www',
])

export function normalizePartnerWebsiteSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

export function validatePartnerWebsiteSlug(slug: string): string | null {
  const s = normalizePartnerWebsiteSlug(slug)
  if (!s || s.length < 2) return 'Slug must be at least 2 characters.'
  if (!SITE_SLUG_RE.test(s)) return 'Slug may only use lowercase letters, numbers, and hyphens.'
  if (RESERVED_SITE_SLUGS.has(s) || isReservedMessagingGuestSlug(s)) return 'This slug is reserved.'
  return null
}

export function partnerWebsitePublicPath(slug: string): string {
  return `/site/${encodeURIComponent(slug)}`
}
