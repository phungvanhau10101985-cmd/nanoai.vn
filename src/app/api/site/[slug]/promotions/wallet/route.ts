import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'
import { fetchActivePromotionGrantsForCustomerFromPg } from '@/lib/db/messaging-partner-promotions-pg'

export const dynamic = 'force-dynamic'

/**
 * W5.4 — Ví quà hiển thị công khai. Khác 188: cho phép copy mã và tự áp ở giỏ hàng ngay (188 chỉ
 * điều hướng sang giỏ hàng) — xem docs/188_BEHAVIOR_SPEC.md mục D.4.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  if (!visitor.thread.guestAccountId && !visitor.thread.linkedUserId) {
    return jsonSitePersonalization(
      request,
      { ok: true, vouchers: [] },
      200,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  const grants = await fetchActivePromotionGrantsForCustomerFromPg({
    partnerId: shop.partnerId,
    guestAccountId: visitor.thread.guestAccountId,
    linkedUserId: visitor.thread.linkedUserId,
  })
  if (grants === null) return NextResponse.json({ error: 'Could not load wallet' }, { status: 500 })

  const vouchers = grants
    .filter((g) => g.promotion.isActive)
    .map((g) => ({
      code: g.promotion.code,
      name: g.promotion.name,
      description: g.promotion.description,
      discountType: g.promotion.discountType,
      discountPercent: g.promotion.discountPercent,
      discountAmount: g.promotion.discountAmount,
      maxDiscountAmount: g.promotion.maxDiscountAmount,
      minSubtotal: g.promotion.minSubtotal,
      source: g.grant.source,
      grantedAt: g.grant.grantedAt,
      expiresAt: g.grant.expiresAt,
    }))

  return jsonSitePersonalization(
    request,
    { ok: true, vouchers },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}
