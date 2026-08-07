import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import {
  catalogCorsHeaders,
  guardPartnerCatalogApi,
  jsonCatalogWithCors,
} from '@/lib/messaging/partner-catalog-api-guard'
import { getProductPurchaseOptions } from '@/lib/messaging/guest-chat-ordering'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function OPTIONS(req: Request) {
  const h = new Headers(catalogCorsHeaders(req))
  h.set('Access-Control-Max-Age', '86400')
  return new NextResponse(null, { status: 204, headers: h })
}

/** GET size/màu + giá + chính sách cọc cho checkout UI */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ partnerId: string; inventoryId: string }> }
) {
  const { partnerId, inventoryId } = await ctx.params
  const gate = await guardPartnerCatalogApi(req, partnerId)
  if (gate) return gate

  const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, inventoryId)
  if (!row || row.is_active === false) {
    return jsonCatalogWithCors(req, { error: 'Product not found.' }, 404)
  }

  const productUrl = (row.product_url ?? '').trim()
  if (!productUrl) {
    return jsonCatalogWithCors(req, { error: 'Product has no product_url.' }, 400)
  }

  const options = await getProductPurchaseOptions({
    partnerId,
    productUrl,
    linkedUserId: null,
  })

  return jsonCatalogWithCors(
    req,
    {
      ok: true,
      inventory_id: inventoryId,
      options,
    },
    200
  )
}
