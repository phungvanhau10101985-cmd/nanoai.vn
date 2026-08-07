import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'
import { validatePromotionCodeFromPg } from '@/lib/db/messaging-partner-promotions-pg'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * W1.4/D.2 — ước tính giảm giá hiển thị ở giỏ hàng TRƯỚC khi checkout. Đây chỉ là ước tính cho FE;
 * backend luôn tính lại toàn bộ 1 lần nữa khi checkout thật (`completeCartCheckout`), không tin
 * số này khi tạo đơn — xem docs/188_BEHAVIOR_SPEC.md mục D.2.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await request.json().catch(() => null)) as {
    code?: string
    cartLines?: Array<{ inventoryId?: string; lineSubtotal?: number }>
  } | null
  const code = String(body?.code ?? '').trim()
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  const cartLines = Array.isArray(body?.cartLines)
    ? body!.cartLines!
        .filter((l) => typeof l?.inventoryId === 'string' && UUID_RE.test(l.inventoryId))
        .map((l) => ({ inventoryId: l.inventoryId as string, lineSubtotal: Math.max(0, Number(l.lineSubtotal) || 0) }))
    : []
  const subtotal = cartLines.reduce((sum, l) => sum + l.lineSubtotal, 0)

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const email = await resolveSiteVisitorEmail(request, shop.partnerId)

  const result = await validatePromotionCodeFromPg({
    partnerId: shop.partnerId,
    code,
    subtotal,
    cartLines,
    guestAccountId: visitor.thread.guestAccountId,
    linkedUserId: visitor.thread.linkedUserId,
    emailNormalized: email,
  })

  if (!result.ok) {
    return jsonSitePersonalization(
      request,
      { ok: false, error: result.error },
      400,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  return jsonSitePersonalization(
    request,
    {
      ok: true,
      code: result.promotion.code,
      name: result.promotion.name,
      discountType: result.promotion.discountType,
      discountPercent: result.promotion.discountPercent,
      discountAmount: result.discountAmount,
      eligibleSubtotal: result.eligibleSubtotal,
    },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}
