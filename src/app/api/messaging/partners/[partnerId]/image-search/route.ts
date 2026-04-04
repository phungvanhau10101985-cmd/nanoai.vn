import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  getClientIpFromRequest,
  getRateLimitRetryAfterSec,
  isRateLimited,
} from '@/lib/api/simple-ip-rate-limit'
import {
  buildInventoryMapByVisionProductId,
  visionProductSearchFromImageBuffer,
} from '@/lib/messaging/partner-vision-product-search'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const PARTNER_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function baseCorsHeaders(req: Request): HeadersInit {
  const h: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  const reqHdrs = req.headers.get('Access-Control-Request-Headers')
  h['Access-Control-Allow-Headers'] =
    reqHdrs?.trim() || 'Authorization, Content-Type, X-Requested-With'
  return h
}

function jsonWithCors(req: Request, body: unknown, status: number, extra?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { ...baseCorsHeaders(req), ...extra },
  })
}

function secretMatches(stored: string | null, bearer: string): boolean {
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

function bufferLooksLikeImage(buf: Buffer): boolean {
  if (buf.length < 12) return false
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true
  return false
}

function rateLimitConfig(): { max: number; windowMs: number } {
  const maxRaw = process.env.IMAGE_SEARCH_RATE_LIMIT_MAX
  const winRaw = process.env.IMAGE_SEARCH_RATE_LIMIT_WINDOW_MS
  const max = Math.min(500, Math.max(5, parseInt(maxRaw || '60', 10) || 60))
  const windowMs = Math.min(600_000, Math.max(10_000, parseInt(winRaw || '60000', 10) || 60_000))
  return { max, windowMs }
}

export async function OPTIONS(req: Request) {
  const h = new Headers(baseCorsHeaders(req))
  h.set('Access-Control-Max-Age', '86400')
  return new NextResponse(null, { status: 204, headers: h })
}

/**
 * API công khai (Bearer) cho web shop: multipart ảnh → sản phẩm gần giống trong catalog Vision.
 * Khuyến nghị gọi từ backend shop để không lộ khóa.
 */
export async function POST(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!PARTNER_ID_UUID_RE.test(partnerId)) {
    return jsonWithCors(req, { error: 'Invalid partner id.' }, 400)
  }

  const ip = getClientIpFromRequest(req)
  const { max: rateMax, windowMs } = rateLimitConfig()
  const rlKey = `image-search:${ip}:${partnerId}`
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

  const db = createServiceRoleClient()

  const { data: partner, error: pErr } = await db
    .from('messaging_partners')
    .select('id, is_active')
    .eq('id', partnerId)
    .maybeSingle()

  if (pErr) return jsonWithCors(req, { error: pErr.message }, 500)
  if (!partner) return jsonWithCors(req, { error: 'Shop not found.' }, 404)
  if (!partner.is_active) {
    return jsonWithCors(req, { error: 'Shop is not active.' }, 403)
  }

  const { data: settings, error: setErr } = await db
    .from('messaging_partner_ai_settings')
    .select('*')
    .eq('partner_id', partnerId)
    .maybeSingle()

  if (setErr) return jsonWithCors(req, { error: setErr.message }, 500)
  if (!settings) {
    return jsonWithCors(req, { error: 'AI settings not found for this shop.' }, 404)
  }
  if (!settings.image_search_api_enabled) {
    return jsonWithCors(req, { error: 'Image search API is disabled for this shop.' }, 403)
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
  if (!settings.vision_product_search_enabled || !settings.vision_index_ready) {
    return jsonWithCors(
      req,
      { error: 'Vision product search is off or the catalog is not synced yet.' },
      503
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return jsonWithCors(req, { error: 'Expected multipart/form-data.' }, 400)
  }

  const file = form.get('image') ?? form.get('file')
  if (!file || !(file instanceof Blob)) {
    return jsonWithCors(req, { error: 'Missing image field (multipart: image or file).' }, 400)
  }
  if (file.size === 0) {
    return jsonWithCors(req, { error: 'Empty file.' }, 400)
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return jsonWithCors(req, { error: 'Image too large (max ~5 MB).' }, 400)
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const type = (file.type || '').toLowerCase()
  const typeOk = type.startsWith('image/')
  const sniffOk =
    !type || type === 'application/octet-stream' ? bufferLooksLikeImage(buf) : false
  if (!typeOk && !sniffOk) {
    return jsonWithCors(req, { error: 'File must be an image (JPEG, PNG, WebP, or GIF).' }, 400)
  }

  const limitRaw = form.get('limit')
  let maxResults = 8
  if (typeof limitRaw === 'string' && limitRaw.trim()) {
    const n = parseInt(limitRaw, 10)
    if (Number.isFinite(n)) maxResults = n
  }

  const { data: invRows } = await db
    .from('messaging_partner_inventory')
    .select('*')
    .eq('partner_id', partnerId)

  const map = buildInventoryMapByVisionProductId(invRows ?? [], partnerId)
  const { candidates, error: visionErr } = await visionProductSearchFromImageBuffer(
    buf,
    settings,
    partnerId,
    map,
    { userId: null },
    { maxResults }
  )

  return jsonWithCors(
    req,
    {
      ok: true,
      products: candidates.map((c) => ({
        inventory_id: c.inventoryId,
        name: c.name,
        sku: c.sku,
        image_url: c.image_url,
        product_url: c.product_url ?? null,
        score: c.score ?? null,
      })),
      error: visionErr ?? null,
    },
    200
  )
}
