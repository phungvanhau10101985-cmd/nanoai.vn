import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import {
  catalogCorsHeaders,
  guardPartnerCatalogApi,
  jsonCatalogWithCors,
} from '@/lib/messaging/partner-catalog-api-guard'
import { mapInventoryRowToPartnerCatalogProduct } from '@/lib/messaging/partner-catalog-api-mapper'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS(req: Request) {
  const h = new Headers(catalogCorsHeaders(req))
  h.set('Access-Control-Max-Age', '86400')
  return new NextResponse(null, { status: 204, headers: h })
}

/** GET một sản phẩm theo inventory_id */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; inventoryId: string }> }
) {
  const { partnerId, inventoryId } = await ctx.params
  const gate = await guardPartnerCatalogApi(req, partnerId)
  if (gate) return gate

  const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, inventoryId)
  if (!row || row.is_active === false) {
    return jsonCatalogWithCors(req, { error: 'Product not found.' }, 404)
  }

  const website = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  const publishedSiteSlug =
    website?.isPublished && website.siteSlug?.trim() ? website.siteSlug.trim() : null

  return jsonCatalogWithCors(req, {
    ok: true,
    product: mapInventoryRowToPartnerCatalogProduct(row, { publishedSiteSlug }),
  })
}
