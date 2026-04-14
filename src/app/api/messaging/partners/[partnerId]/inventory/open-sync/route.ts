import { timingSafeEqual } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import {
  getClientIpFromRequest,
  getRateLimitRetryAfterSec,
  isRateLimited,
} from '@/lib/api/simple-ip-rate-limit'
import {
  buildOpenCatalogReconcileRows,
  parseOpenCatalogBody,
} from '@/lib/messaging/partner-inventory-open-sync'
import {
  listPartnerInventoryRows,
  upsertPartnerInventoryBatch,
} from '@/lib/messaging/partner-inventory-upsert-batch'
import { fetchMessagingPartnerAiImageSearchAuthFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'
import { fetchMessagingPartnerByIdFromPg, isMessagingPartnerInboundOpen } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 600

const MAX_JSON_BYTES = Math.max(
  1_000_000,
  Math.min(
    100_000_000,
    parseInt(process.env.PARTNER_INVENTORY_OPEN_SYNC_MAX_BODY_BYTES || '35000000', 10) || 35_000_000
  )
)
const MAX_OPEN_SYNC_ITEMS = Math.max(
  500,
  Math.min(
    200_000,
    parseInt(process.env.PARTNER_INVENTORY_OPEN_SYNC_MAX_ITEMS || '100000', 10) || 100_000
  )
)

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

function rateLimitConfig(): { max: number; windowMs: number } {
  const maxRaw = process.env.PARTNER_INVENTORY_OPEN_SYNC_RATE_LIMIT_MAX ?? process.env.IMAGE_SEARCH_RATE_LIMIT_MAX
  const winRaw =
    process.env.PARTNER_INVENTORY_OPEN_SYNC_RATE_LIMIT_WINDOW_MS ?? process.env.IMAGE_SEARCH_RATE_LIMIT_WINDOW_MS
  const max = Math.min(200, Math.max(3, parseInt(maxRaw || '30', 10) || 30))
  const windowMs = Math.min(600_000, Math.max(10_000, parseInt(winRaw || '60000', 10) || 60_000))
  return { max, windowMs }
}

export async function OPTIONS(req: Request) {
  const h = new Headers(baseCorsHeaders(req))
  h.set('Access-Control-Max-Age', '86400')
  return new NextResponse(null, { status: 204, headers: h })
}

/**
 * Open Catalog — đồng bộ kho từ backend web shop → NanoAI.
 * Chuẩn JSON gần Shopee-style (item_sku, item_name, item_status, image.image_url_list, …).
 *
 * Auth: cùng khóa Bearer với «API tìm sản phẩm bằng ảnh» (Messaging → AI → bật API công khai).
 * Chỉ cần `image_search_api_enabled` + secret; **không** yêu cầu Vision.
 */
export async function POST(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!PARTNER_ID_UUID_RE.test(partnerId)) {
    return jsonWithCors(req, { error: 'Invalid partner id.', code: 'INVALID_PARTNER_ID' }, 400)
  }

  const ip = getClientIpFromRequest(req)
  const { max: rateMax, windowMs } = rateLimitConfig()
  const rlKey = `inventory-open-sync:${ip}:${partnerId}`
  if (isRateLimited(rlKey, rateMax, windowMs)) {
    const retry = getRateLimitRetryAfterSec(rlKey)
    return jsonWithCors(
      req,
      { error: 'Too many requests. Try again later.', code: 'RATE_LIMIT', retry_after_sec: retry },
      429,
      { 'Retry-After': String(retry) }
    )
  }

  const authz = req.headers.get('authorization')?.trim() ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(authz)
  const bearer = m?.[1]?.trim() ?? ''
  if (!bearer) {
    return jsonWithCors(
      req,
      { error: 'Missing Authorization: Bearer <api_key>.', code: 'MISSING_AUTH' },
      401
    )
  }

  const ct = req.headers.get('content-type')?.toLowerCase() ?? ''
  if (!ct.includes('application/json')) {
    return jsonWithCors(req, { error: 'Content-Type must be application/json.', code: 'BAD_CONTENT_TYPE' }, 415)
  }

  const rawBuf = Buffer.from(await req.arrayBuffer())
  if (rawBuf.length === 0) {
    return jsonWithCors(req, { error: 'Empty body.', code: 'EMPTY_BODY' }, 400)
  }
  if (rawBuf.length > MAX_JSON_BYTES) {
    return jsonWithCors(req, { error: 'JSON body too large.', code: 'BODY_TOO_LARGE' }, 413)
  }

  let body: unknown
  try {
    body = JSON.parse(rawBuf.toString('utf8')) as unknown
  } catch {
    return jsonWithCors(req, { error: 'Invalid JSON.', code: 'INVALID_JSON' }, 400)
  }

  const parsed = parseOpenCatalogBody(body, { maxItems: MAX_OPEN_SYNC_ITEMS })
  if (!parsed.ok) {
    return jsonWithCors(req, { error: parsed.error, code: parsed.code }, 400)
  }

  if (!isPgConfigured()) {
    return jsonWithCors(req, { error: 'Server database is not configured.', code: 'DB_NOT_CONFIGURED' }, 503)
  }

  const partner = await fetchMessagingPartnerByIdFromPg(partnerId)
  if (!partner) {
    return jsonWithCors(req, { error: 'Shop not found.', code: 'SHOP_NOT_FOUND' }, 404)
  }
  if (!isMessagingPartnerInboundOpen(partner)) {
    return jsonWithCors(req, { error: 'Shop is not active or scheduled for deletion.', code: 'SHOP_INACTIVE' }, 403)
  }

  const settings = await fetchMessagingPartnerAiImageSearchAuthFromPg(partnerId)
  if (settings === null) {
    return jsonWithCors(
      req,
      {
        error: 'AI settings not found. Save Messaging AI settings once in the dashboard.',
        code: 'NO_AI_SETTINGS',
      },
      404
    )
  }
  if (!settings.image_search_api_enabled) {
    return jsonWithCors(
      req,
      { error: 'Partner API is disabled. Enable it under Dashboard → API integration.', code: 'API_DISABLED' },
      403
    )
  }
  if (!settings.image_search_api_secret?.trim()) {
    return jsonWithCors(
      req,
      {
        error:
          'API key not set. Generate a key in the dashboard (Dashboard → API integration / Messaging → AI).',
        code: 'NO_API_KEY',
      },
      503
    )
  }
  if (!secretMatches(settings.image_search_api_secret, bearer)) {
    return jsonWithCors(req, { error: 'Invalid API key.', code: 'INVALID_KEY' }, 401)
  }

  const listed = await listPartnerInventoryRows(partnerId)
  if (!listed.ok) return jsonWithCors(req, { error: listed.error, code: 'DB_ERROR' }, 500)
  const reconcileRows = buildOpenCatalogReconcileRows(parsed.rows, listed.rows)
  const batch = await upsertPartnerInventoryBatch(partnerId, reconcileRows, {
    existingRows: listed.rows,
  })
  if (!batch.ok) {
    return jsonWithCors(req, { error: batch.error, code: 'UPSERT_FAILED' }, 500)
  }

  // Vision Warehouse da bi go bo khoi du an: khong enqueue background sync.
  const visionBgSyncQueued = false

  revalidatePath('/dashboard/messaging')
  revalidatePath('/dashboard/messaging/settings')
  revalidatePath('/dashboard/api-integration')

  return jsonWithCors(req, {
    ok: true,
    request_id: parsed.request_id,
    count: parsed.rows.length,
    inserted: batch.inserted,
    updated: batch.updated,
    deleted: batch.deleted,
    vision_bg_sync_queued: visionBgSyncQueued,
  }, 200)
}
