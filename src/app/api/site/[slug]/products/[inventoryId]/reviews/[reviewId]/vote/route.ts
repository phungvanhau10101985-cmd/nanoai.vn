import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'
import { togglePartnerProductReviewVoteFromPg } from '@/lib/db/messaging-partner-reviews-pg'

export const dynamic = 'force-dynamic'

/** W1.5 — toggle vote hữu ích. Không bắt buộc đăng nhập (voterKey = session ẩn danh nếu chưa login). */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string; inventoryId: string; reviewId: string }> }
) {
  const { slug, reviewId } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const result = await togglePartnerProductReviewVoteFromPg({
    reviewId,
    voterKey: visitor.accountKey,
  })
  if (!result.ok) {
    return jsonSitePersonalization(
      request,
      { error: 'Could not vote' },
      500,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }
  return jsonSitePersonalization(
    request,
    { ok: true, voted: result.voted, usefulCount: result.usefulCount },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}
