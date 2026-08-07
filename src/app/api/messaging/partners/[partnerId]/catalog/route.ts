import { NextRequest } from 'next/server'
import {
  fetchPartnerInventoryActivePageWithCountFromPg,
  fetchPartnerInventoryRowBySkuForPartnerFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import {
  catalogCorsHeaders,
  guardPartnerCatalogApi,
  jsonCatalogWithCors,
} from '@/lib/messaging/partner-catalog-api-guard'
import { mapInventoryRowToPartnerCatalogProduct } from '@/lib/messaging/partner-catalog-api-mapper'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_PAGE = 100

function parseBoolParam(raw: string | null, defaultValue: boolean): boolean {
  if (raw == null || raw === '') return defaultValue
  const t = raw.trim().toLowerCase()
  if (t === '1' || t === 'true' || t === 'yes') return true
  if (t === '0' || t === 'false' || t === 'no') return false
  return defaultValue
}

export async function OPTIONS(req: Request) {
  const h = new Headers(catalogCorsHeaders(req))
  h.set('Access-Control-Max-Age', '86400')
  return new NextResponse(null, { status: 204, headers: h })
}

/**
 * GET catalog — danh mục sản phẩm headless (Bearer, CORS).
 * Query: offset, limit (max 100), shop_ready_only (default false), sku (optional).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await guardPartnerCatalogApi(req, partnerId)
  if (gate) return gate

  const shopReadyOnly = parseBoolParam(req.nextUrl.searchParams.get('shop_ready_only'), false)
  const sku = req.nextUrl.searchParams.get('sku')?.trim() ?? ''

  const website = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  const publishedSiteSlug =
    website?.isPublished && website.siteSlug?.trim() ? website.siteSlug.trim() : null
  const mapCtx = { publishedSiteSlug }

  if (sku) {
    const row = await fetchPartnerInventoryRowBySkuForPartnerFromPg(partnerId, sku)
    if (!row || row.is_active === false) {
      return jsonCatalogWithCors(req, { ok: true, products: [], total: 0, offset: 0, limit: 1 }, 200)
    }
    const product = mapInventoryRowToPartnerCatalogProduct(row, mapCtx)
    if (shopReadyOnly && !product.shop_ready) {
      return jsonCatalogWithCors(req, { ok: true, products: [], total: 0, offset: 0, limit: 1 }, 200)
    }
    return jsonCatalogWithCors(
      req,
      {
        ok: true,
        products: [product],
        total: 1,
        offset: 0,
        limit: 1,
      },
      200
    )
  }

  const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset') ?? 0) || 0)
  const limit = Math.min(
    MAX_PAGE,
    Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 24) || 24)
  )

  const page = await fetchPartnerInventoryActivePageWithCountFromPg(partnerId, offset, limit)
  if (!page) {
    return jsonCatalogWithCors(req, { error: 'Could not load catalog.' }, 500)
  }

  let products = page.rows.map((row) => mapInventoryRowToPartnerCatalogProduct(row, mapCtx))
  if (shopReadyOnly) {
    products = products.filter((p) => p.shop_ready)
  }

  return jsonCatalogWithCors(
    req,
    {
      ok: true,
      products,
      total: page.count,
      offset,
      limit,
      shop_ready_only: shopReadyOnly,
      published_site_slug: publishedSiteSlug,
    },
    200
  )
}
