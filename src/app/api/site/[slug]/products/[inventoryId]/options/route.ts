import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerInventoryProductUrlFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { getProductPurchaseOptions } from '@/lib/messaging/guest-chat-ordering'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string; inventoryId: string }> }
) {
  const { slug, inventoryId } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const productUrl = await fetchPartnerInventoryProductUrlFromPg(shop.partnerId, inventoryId)
  if (productUrl == null) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!productUrl) return NextResponse.json({ error: 'Invalid product' }, { status: 400 })

  const user = await getEmailSessionUser()
  const options = await getProductPurchaseOptions({
    partnerId: shop.partnerId,
    productUrl,
    linkedUserId: user?.id ?? null,
  })

  return NextResponse.json({ ok: true, options })
}
