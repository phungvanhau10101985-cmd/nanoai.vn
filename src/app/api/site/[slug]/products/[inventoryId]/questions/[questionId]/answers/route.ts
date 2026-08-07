import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'
import { insertPartnerProductBuyerAnswerFromPg } from '@/lib/db/messaging-partner-reviews-pg'

export const dynamic = 'force-dynamic'

/**
 * W1.5/C.2 — trả lời của khách mua hàng khác. Điều kiện: đăng nhập + có đơn hàng (không huỷ) chứa
 * đúng sản phẩm đó. Giới hạn slot công khai (QA_BUYER_ANSWER_LIMIT) enforce ở DB layer.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string; inventoryId: string; questionId: string }> }
) {
  const { slug, inventoryId, questionId } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  if (!visitor.thread.guestAccountId && !visitor.thread.linkedUserId) {
    return jsonSitePersonalization(
      request,
      { error: 'login_required' },
      401,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  const body = (await request.json().catch(() => null)) as { content?: string; responderName?: string } | null
  const content = String(body?.content ?? '').trim()
  if (!content) {
    return jsonSitePersonalization(
      request,
      { error: 'content required' },
      400,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  let responderName = String(body?.responderName ?? '').trim()
  if (!responderName) {
    const email = await resolveSiteVisitorEmail(request, shop.partnerId)
    responderName = email ? email.split('@')[0] : 'Khách hàng'
  }

  const result = await insertPartnerProductBuyerAnswerFromPg({
    partnerId: shop.partnerId,
    questionId,
    inventoryId,
    guestAccountId: visitor.thread.guestAccountId,
    linkedUserId: visitor.thread.linkedUserId,
    responderName,
    content,
  })

  if (!result.ok) {
    const status = result.error === 'not_eligible' ? 403 : result.error === 'slot_full' ? 409 : 500
    return jsonSitePersonalization(
      request,
      { error: result.error },
      status,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  return jsonSitePersonalization(
    request,
    { ok: true, answer: result.row },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}
