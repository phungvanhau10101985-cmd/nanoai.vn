import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { fetchMessagingPartnerAiImageSearchAuthFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'
import { fetchMessagingPartnerByIdFromPg, isMessagingPartnerInboundOpen } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import {
  getClientIpFromRequest,
  getRateLimitRetryAfterSec,
  isRateLimited,
} from '@/lib/api/simple-ip-rate-limit'

export const PARTNER_INVENTORY_SEARCH_API_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function baseCorsHeaders(req: Request): HeadersInit {
  const h: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  const reqHdrs = req.headers.get('Access-Control-Request-Headers')
  h['Access-Control-Allow-Headers'] =
    reqHdrs?.trim() || 'Authorization, Content-Type, X-Requested-With'
  return h
}

export function jsonWithCors(req: Request, body: unknown, status: number, extra?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { ...baseCorsHeaders(req), ...extra },
  })
}

export function secretMatches(stored: string | null, bearer: string): boolean {
  if (!stored || !bearer) return false
  try {
    const a = Buffer.from(stored, 'utf8')
    const b = Buffer.from(bearer, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function rateLimitConfig(): { max: number; windowMs: number } {
  const maxRaw = process.env.IMAGE_SEARCH_RATE_LIMIT_MAX
  const winRaw = process.env.IMAGE_SEARCH_RATE_LIMIT_WINDOW_MS
  const max = Math.min(500, Math.max(5, parseInt(maxRaw || '60', 10) || 60))
  const windowMs = Math.min(600_000, Math.max(10_000, parseInt(winRaw || '60000', 10) || 60_000))
  return { max, windowMs }
}

/**
 * Xác thực Bearer + shop mở API tìm kho (dùng chung image-search và text-search).
 * @param rateKeyPrefix ví dụ `image-search` hoặc `text-search` (cùng giới hạn IP+shop)
 */
export async function guardPartnerInventorySearchApi(
  req: Request,
  partnerId: string,
  rateKeyPrefix: string
): Promise<NextResponse | null> {
  if (!PARTNER_INVENTORY_SEARCH_API_ID_RE.test(partnerId)) {
    return jsonWithCors(req, { error: 'Invalid partner id.' }, 400)
  }

  const ip = getClientIpFromRequest(req)
  const { max: rateMax, windowMs } = rateLimitConfig()
  const rlKey = `${rateKeyPrefix}:${ip}:${partnerId}`
  if (isRateLimited(rlKey, rateMax, windowMs)) {
    const retry = getRateLimitRetryAfterSec(rlKey)
    return jsonWithCors(
      req,
      { error: 'Too many requests. Try again later.', retry_after_sec: retry },
      429,
      { 'Retry-After': String(retry) }
    )
  }

  const authz = req.headers.get('authorization')?.trim() ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(authz)
  const bearer = m?.[1]?.trim() ?? ''
  if (!bearer) {
    return jsonWithCors(req, { error: 'Missing Authorization: Bearer <api_key>.' }, 401)
  }

  if (!isPgConfigured()) {
    return jsonWithCors(req, { error: 'Server database is not configured.' }, 503)
  }

  const partner = await fetchMessagingPartnerByIdFromPg(partnerId)
  if (!partner) {
    return jsonWithCors(req, { error: 'Shop not found.' }, 404)
  }
  if (!isMessagingPartnerInboundOpen(partner)) {
    return jsonWithCors(req, { error: 'Shop is not active or not accepting API traffic.' }, 403)
  }

  const settings = await fetchMessagingPartnerAiImageSearchAuthFromPg(partnerId)
  if (settings === null) {
    return jsonWithCors(req, { error: 'AI settings not found for this shop.' }, 404)
  }
  if (!settings.image_search_api_enabled) {
    return jsonWithCors(req, { error: 'Public product search API (image / text) is disabled for this shop.' }, 403)
  }
  if (!settings.image_search_api_secret?.trim()) {
    return jsonWithCors(
      req,
      {
        error:
          'API key not set. Generate a key in the shop dashboard (Dashboard → API integration, /dashboard/api-integration).',
      },
      503
    )
  }
  if (!secretMatches(settings.image_search_api_secret, bearer)) {
    return jsonWithCors(req, { error: 'Invalid API key.' }, 401)
  }

  return null
}
