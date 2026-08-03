/**
 * URL gốc công khai (https://domain) — dùng trong email magic link; không có dấu / cuối.
 *
 * Thứ tự:
 * 1. APP_URL — ghi rõ trên server production (khuyến nghị).
 * 2. Origin từ request (Host / X-Forwarded-*) — khi user mở site qua domain thật nhưng .env vẫn localhost.
 * 3. NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_BASE_URL
 * 4. http://localhost:3000
 */

function stripBase(s: string): string {
  return s.trim().replace(/\/$/, '')
}

/**
 * Origin công khai từ request (ưu tiên header reverse proxy).
 */
function isLocalHostLike(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host.trim())
}

export function getOriginFromRequest(req: Request): string | null {
  const host =
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host')?.split(',')[0]?.trim() || ''

  if (host) {
    let proto =
      req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
      (req.headers.get('x-forwarded-ssl') === 'on' ? 'https' : '') ||
      ''
    if (!proto) {
      proto = isLocalHostLike(host) ? 'http' : 'https'
    }
    return stripBase(`${proto}://${host}`)
  }

  try {
    const u = new URL(req.url)
    if (u.host && u.protocol) {
      return stripBase(`${u.protocol}//${u.host}`)
    }
  } catch {
    /* ignore */
  }
  return null
}

export function getPublicAppUrlForServer(req?: Request): string {
  const appUrl = process.env.APP_URL?.trim()
  if (appUrl) return stripBase(appUrl)

  if (req) {
    const fromReq = getOriginFromRequest(req)
    if (fromReq) return fromReq
  }

  for (const c of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_BASE_URL]) {
    const t = c?.trim()
    if (t) return stripBase(t)
  }

  return 'http://localhost:3000'
}

/** OAuth callback / redirect sau login — ưu tiên Host request (localhost dev), không ép APP_URL production. */
export function getAuthFlowOrigin(req: Request): string {
  const fromReq = getOriginFromRequest(req)
  if (fromReq) return fromReq
  return getPublicAppUrlForServer(req)
}

/**
 * Public origin in App Router RSC / route handlers from `headers()` (`next/headers`).
 * Keeps server HTML aligned with the client for absolute URLs built during SSR.
 */
export function getPublicOriginFromAppRouterHeaders(h: Headers): string {
  const synthetic = new Request('https://placeholder.invalid', { headers: h })
  const fromReq = getOriginFromRequest(synthetic)
  if (fromReq) return fromReq
  return getPublicAppUrlForServer()
}
