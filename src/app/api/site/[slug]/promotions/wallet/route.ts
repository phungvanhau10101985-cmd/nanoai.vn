import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'
import {
  checkCustomerHasPriorOrderFromPg,
  expireWorthlessPromotionGrantsForCustomerFromPg,
  fetchActivePromotionGrantsForCustomerFromPg,
  fetchPromotionUsageCountsForCustomerFromPg,
} from '@/lib/db/messaging-partner-promotions-pg'
import {
  assessPromotionCustomerEligibility,
  isPermanentlyUnusablePromoError,
  promotionToCustomerEligibilityFields,
} from '@/lib/partner-website/promotions/partner-promotion-eligibility'

export const dynamic = 'force-dynamic'

/**
 * W5.4 — Ví quà hiển thị công khai. Khác 188: cho phép copy mã và tự áp ở giỏ hàng ngay (188 chỉ
 * điều hướng sang giỏ hàng) — xem docs/188_BEHAVIOR_SPEC.md mục D.4.
 * Ví chỉ trả mã còn dùng được hoặc tạm chưa đủ điều kiện (min đơn). Grant first-order
 * đã hết giá trị (đã có đơn) bị hết hạn và không còn hiện — giống ví 188 ẩn mã used/expired.
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

  const emailNormalized = await resolveSiteVisitorEmail(request, shop.partnerId)
  await expireWorthlessPromotionGrantsForCustomerFromPg({
    partnerId: shop.partnerId,
    guestAccountId: visitor.thread.guestAccountId,
    linkedUserId: visitor.thread.linkedUserId,
    emailNormalized,
  })
  const liveGrants = await fetchActivePromotionGrantsForCustomerFromPg({
    partnerId: shop.partnerId,
    guestAccountId: visitor.thread.guestAccountId,
    linkedUserId: visitor.thread.linkedUserId,
  })
  if (liveGrants === null) return NextResponse.json({ error: 'Could not load wallet' }, { status: 500 })

  const subtotal = Math.max(0, Number(request.nextUrl.searchParams.get('subtotal') ?? 0) || 0)
  const [hasPriorOrder, usageCounts] = await Promise.all([
    checkCustomerHasPriorOrderFromPg({
      partnerId: shop.partnerId,
      guestAccountId: visitor.thread.guestAccountId,
      linkedUserId: visitor.thread.linkedUserId,
      emailNormalized,
    }),
    fetchPromotionUsageCountsForCustomerFromPg({
      promotionIds: liveGrants.map((g) => g.promotion.id),
      guestAccountId: visitor.thread.guestAccountId,
      linkedUserId: visitor.thread.linkedUserId,
    }),
  ])
  const now = Date.now()
  const vouchers = liveGrants
    .filter((g) => g.promotion.isActive)
    .map((g) => {
      const ineligibleReason = assessPromotionCustomerEligibility({
        ...promotionToCustomerEligibilityFields(g.promotion),
        now,
        subtotal,
        hasPriorOrder,
        usedByCustomerCount: usageCounts.get(g.promotion.id) ?? 0,
      })
      return {
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
        eligible: !ineligibleReason,
        ineligibleReason,
        expiresSoon:
          Boolean(g.grant.expiresAt) &&
          new Date(g.grant.expiresAt as string).getTime() - now <= 3 * 86_400_000,
      }
    })
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.code.localeCompare(b.code))
    .filter((v) => !isPermanentlyUnusablePromoError(v.ineligibleReason))

  return jsonSitePersonalization(
    request,
    { ok: true, vouchers, badgeCount: vouchers.length },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}
