/**
 * Custom-domain slug cookie — skip resolve-host hop after the first hit.
 * HMAC binds slug to Host so a visitor cannot point gudo.vn at another shop.
 */

export const PARTNER_CUSTOM_DOMAIN_SLUG_COOKIE = 'pw-cd-slug'
export const PARTNER_EDGE_HEADER = 'x-nanoai-edge'
export const PARTNER_CUSTOM_DOMAIN_SLUG_MAX_AGE_SEC = 300

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/i

function edgeSecret(): string {
  return (
    process.env.NANOAI_EDGE_SECRET?.trim() ||
    process.env.APP_INTERNAL_URL?.trim() ||
    'nanoai-partner-edge'
  )
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(edgeSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return toHex(sig).slice(0, 24)
}

export function isPartnerSiteSlugToken(raw: string): boolean {
  return SLUG_RE.test(String(raw || '').trim())
}

export function requestCameFromNanoaiEdge(getHeader: (name: string) => string | null): boolean {
  const token = (getHeader(PARTNER_EDGE_HEADER) || getHeader('X-NanoAI-Edge') || '').trim()
  return token === '1' || token.toLowerCase() === 'true'
}

export async function signPartnerCustomDomainSlugCookie(host: string, slug: string): Promise<string> {
  const h = host.trim().toLowerCase()
  const s = slug.trim().toLowerCase()
  if (!h || !isPartnerSiteSlugToken(s)) return ''
  const sig = await hmacHex(`${h}\n${s}`)
  return `${s}.${sig}`
}

export async function readSignedPartnerCustomDomainSlug(
  host: string,
  cookieValue: string | null | undefined
): Promise<string> {
  const raw = String(cookieValue || '').trim()
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return ''
  const slug = raw.slice(0, dot).trim().toLowerCase()
  const sig = raw.slice(dot + 1).trim().toLowerCase()
  if (!isPartnerSiteSlugToken(slug) || !sig) return ''
  const expected = await hmacHex(`${host.trim().toLowerCase()}\n${slug}`)
  if (expected !== sig) return ''
  return slug
}

export function trustedPartnerSiteSlugFromEdgeHeaders(input: {
  getHeader: (name: string) => string | null
  host: string
}): string {
  if (!requestCameFromNanoaiEdge(input.getHeader)) return ''
  const slug = (input.getHeader('x-partner-site-slug') || '').trim().toLowerCase()
  return isPartnerSiteSlugToken(slug) ? slug : ''
}
