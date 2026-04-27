import { NextResponse } from 'next/server'
import {
  baseCorsHeaders,
  guardPartnerInventorySearchApi,
  jsonWithCors,
} from '@/lib/messaging/partner-inventory-search-api-guard'
import { matchInventoryForPublicTextSearchApi } from '@/lib/messaging/partner-inventory-text-embedding'
import {
  getPartnerPublicInventorySearchDefaultLimit,
  PARTNER_PUBLIC_INVENTORY_SEARCH_MAX,
} from '@/lib/messaging/partner-public-search-limits'
import {
  colorImageUrlsForInventorySearch,
  fetchPartnerInventorySearchEnrichmentByIdsFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { parseColorVariantsJson } from '@/lib/messaging/inventory-color-variants'
import { isPgConfigured } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_LIMIT = PARTNER_PUBLIC_INVENTORY_SEARCH_MAX

function parseJsonBody(text: string): { q: string; limit: number } | null {
  try {
    const o = JSON.parse(text) as { q?: unknown; query?: unknown; limit?: unknown }
    const q = String(o.q ?? o.query ?? '').trim()
    let limit = getPartnerPublicInventorySearchDefaultLimit()
    if (o.limit != null) {
      const n = parseInt(String(o.limit), 10)
      if (Number.isFinite(n)) limit = n
    }
    return { q, limit: Math.max(1, Math.min(MAX_LIMIT, limit)) }
  } catch {
    return null
  }
}

export async function OPTIONS(req: Request) {
  const h = new Headers(baseCorsHeaders(req))
  h.set('Access-Control-Max-Age', '86400')
  return new NextResponse(null, { status: 204, headers: h })
}

/**
 * API công khai (Bearer): câu tìm → embed văn bản (Gemini) → ANN theo text_embedding vector trong kho.
 * Cùng khóa, mặc định / `limit` tối đa / biến môi trường `PARTNER_PUBLIC_INVENTORY_SEARCH_*` như `image-search`.
 */
export async function POST(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params

  const gate = await guardPartnerInventorySearchApi(req, partnerId, 'text-search')
  if (gate) return gate

  const ct = (req.headers.get('content-type') || '').toLowerCase()
  let q = ''
  let limit = getPartnerPublicInventorySearchDefaultLimit()

  if (ct.includes('application/json')) {
    const raw = await req.text()
    const parsed = parseJsonBody(raw)
    if (!parsed) {
      return jsonWithCors(req, { error: 'Invalid JSON. Expected { "q": "…", "limit"?: number }.' }, 400)
    }
    q = parsed.q
    limit = parsed.limit
  } else if (ct.includes('application/x-www-form-urlencoded')) {
    const text = await req.text()
    const sp = new URLSearchParams(text)
    q = String(sp.get('q') ?? sp.get('query') ?? '').trim()
    const lr = sp.get('limit')
    if (lr) {
      const n = parseInt(lr, 10)
      if (Number.isFinite(n)) limit = Math.max(1, Math.min(MAX_LIMIT, n))
    }
  } else {
    return jsonWithCors(
      req,
      {
        error: 'Content-Type must be application/json (preferred) or application/x-www-form-urlencoded.',
      },
      415
    )
  }

  if (q.length < 2) {
    return jsonWithCors(req, { error: 'Query too short (min 2 characters, fields q or query).' }, 400)
  }

  const out = await matchInventoryForPublicTextSearchApi(partnerId, q, limit)
  if (!out.ok) {
    if (out.reason === 'query_short') {
      return jsonWithCors(req, { error: 'Query too short (min 2 characters).' }, 400)
    }
    if (out.reason === 'db_error') {
      return jsonWithCors(req, { error: 'Vector search failed.' }, 500)
    }
    return jsonWithCors(
      req,
      {
        ok: true,
        products: [] as const,
        error: 'Text embedding unavailable. Ensure GOOGLE_API_KEY is set on the server and catalog text embeddings are synced.',
      },
      200
    )
  }

  const ids = out.matches.map((c) => c.inventory_id)
  const enrichById =
    ids.length > 0 && isPgConfigured()
      ? await fetchPartnerInventorySearchEnrichmentByIdsFromPg(partnerId, ids)
      : null
  const products = out.matches.map((c) => {
    const en = enrichById?.get(c.inventory_id)
    const ph = en?.price_hint?.trim() ?? ''
    const color_image_urls = en
      ? colorImageUrlsForInventorySearch(
          c.image_url,
          en.material_detail_image_url,
          en.real_use_image_url,
          en.real_use_image_url_2
        )
      : []
    const color_variants = en ? parseColorVariantsJson(en.stock_note) : []
    return {
      inventory_id: c.inventory_id,
      name: c.name,
      sku: c.sku,
      image_url: c.image_url,
      product_url: c.product_url ?? null,
      score: c.score,
      price_hint: ph ? ph : null,
      color_variants,
      color_image_urls,
    }
  })

  return jsonWithCors(
    req,
    {
      ok: true,
      products,
      error: products.length > 0 ? null : 'No matching products.',
    },
    200
  )
}
