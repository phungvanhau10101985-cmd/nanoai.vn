import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'
import {
  fetchPartnerProductQuestionsPageFromPg,
  insertPartnerProductQuestionFromPg,
} from '@/lib/db/messaging-partner-reviews-pg'
import { fetchPartnerInventoryReviewQuestionLookupFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { notifyPartnerOwnerNewQuestion } from '@/lib/messaging/partner-admin-notifications'
import {
  PUBLIC_REVIEW_QA_PAGE_SIZE,
  PUBLIC_REVIEW_QA_PAGE_SIZE_MAX,
  coalesceImportGroup,
  qaBuyerAnswerShowsVerifiedBadge,
} from '@/lib/partner-website/reviews/partner-review-types'

export const dynamic = 'force-dynamic'

/** W1.5/C.2 — GET: danh sách hỏi đáp công khai. POST: hỏi (chỉ cần đăng nhập, không cần mua hàng). */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string; inventoryId: string }> }
) {
  const { slug, inventoryId } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = request.nextUrl
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const pageSize = Math.min(
    PUBLIC_REVIEW_QA_PAGE_SIZE_MAX,
    Math.max(1, Number(url.searchParams.get('pageSize') ?? PUBLIC_REVIEW_QA_PAGE_SIZE) || PUBLIC_REVIEW_QA_PAGE_SIZE)
  )

  const inv = await fetchPartnerInventoryReviewQuestionLookupFromPg(shop.partnerId, inventoryId)
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const importGroup = coalesceImportGroup(inv.questionGroupId)

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const result = await fetchPartnerProductQuestionsPageFromPg({
    partnerId: shop.partnerId,
    inventoryId,
    importGroup,
    page,
    pageSize,
    viewerAccountKey: visitor.accountKey,
  })
  if (result === null) return NextResponse.json({ error: 'Could not load questions' }, { status: 500 })

  return jsonSitePersonalization(
    request,
    {
      ok: true,
      questions: result.rows.map((q) => ({
        ...q,
        answers: q.answers.map((a) => ({ ...a, verified: qaBuyerAnswerShowsVerifiedBadge(a) })),
      })),
      total: result.total,
      page,
      pageSize,
    },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string; inventoryId: string }> }
) {
  const { slug, inventoryId } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const inv = await fetchPartnerInventoryReviewQuestionLookupFromPg(shop.partnerId, inventoryId)
  if (!inv) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  if (!visitor.thread.guestAccountId && !visitor.thread.linkedUserId) {
    return jsonSitePersonalization(
      request,
      { error: 'login_required' },
      401,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  const body = (await request.json().catch(() => null)) as { content?: string; askerName?: string } | null
  const content = String(body?.content ?? '').trim()
  if (!content) {
    return jsonSitePersonalization(
      request,
      { error: 'content required' },
      400,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  let askerName = String(body?.askerName ?? '').trim()
  if (!askerName) {
    const email = await resolveSiteVisitorEmail(request, shop.partnerId)
    askerName = email ? email.split('@')[0] : 'Khách hàng'
  }

  const row = await insertPartnerProductQuestionFromPg({
    partnerId: shop.partnerId,
    inventoryId,
    guestAccountId: visitor.thread.guestAccountId,
    linkedUserId: visitor.thread.linkedUserId,
    askerName,
    content,
  })
  if (!row) {
    return jsonSitePersonalization(
      request,
      { error: 'Could not submit question' },
      500,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  notifyPartnerOwnerNewQuestion({
    partnerId: shop.partnerId,
    askerName: row.askerName,
    content: row.content,
  }).catch((e) => console.warn('[questions POST] notify owner', e))

  return jsonSitePersonalization(
    request,
    { ok: true, question: { ...row, answers: [] } },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}
