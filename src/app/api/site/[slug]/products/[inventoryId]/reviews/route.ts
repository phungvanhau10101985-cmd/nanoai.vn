import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'
import {
  fetchPartnerProductRatingSummaryFromPg,
  fetchPartnerProductReviewsPageFromPg,
  insertPartnerProductReviewFromPg,
} from '@/lib/db/messaging-partner-reviews-pg'
import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import {
  PUBLIC_REVIEW_QA_PAGE_SIZE,
  PUBLIC_REVIEW_QA_PAGE_SIZE_MAX,
  clampRating,
  coalesceImportGroup,
  reviewShowsVerifiedBadge,
  reviewTitleTemplate,
  sanitizeReviewImageUrls,
} from '@/lib/partner-website/reviews/partner-review-types'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { notifyPartnerOwnerNewReview } from '@/lib/messaging/partner-admin-notifications'

export const dynamic = 'force-dynamic'

/** W1.5 — GET: rating summary + trang review công khai. POST: gửi review (verified purchase enforce ở DB). */
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
  const ratingFilterRaw = Number(url.searchParams.get('rating') ?? 0)
  const ratingFilter = ratingFilterRaw >= 1 && ratingFilterRaw <= 5 ? ratingFilterRaw : undefined

  const inv = await fetchPartnerInventoryRowByIdForPartnerFromPg(shop.partnerId, inventoryId)
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const importGroup = coalesceImportGroup(inv.rating_group_id)

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const [summary, page1] = await Promise.all([
    fetchPartnerProductRatingSummaryFromPg(shop.partnerId, inventoryId, importGroup),
    fetchPartnerProductReviewsPageFromPg({
      partnerId: shop.partnerId,
      inventoryId,
      importGroup,
      page,
      pageSize,
      viewerAccountKey: visitor.accountKey,
      ratingFilter,
    }),
  ])
  if (page1 === null) return NextResponse.json({ error: 'Could not load reviews' }, { status: 500 })

  return jsonSitePersonalization(
    request,
    {
      ok: true,
      summary,
      reviews: page1.rows.map((r) => ({ ...r, verified: reviewShowsVerifiedBadge(r) })),
      total: page1.total,
      page,
      pageSize,
      hasReviewed: page1.hasReviewed,
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

  const inv = await fetchPartnerInventoryRowByIdForPartnerFromPg(shop.partnerId, inventoryId)
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

  const body = (await request.json().catch(() => null)) as {
    rating?: number
    title?: string
    content?: string
    imageUrls?: unknown
    reviewerName?: string
    locale?: string
  } | null
  const content = String(body?.content ?? '').trim()
  if (!content) {
    return jsonSitePersonalization(
      request,
      { error: 'content required' },
      400,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  const rating = clampRating(body?.rating)
  const locale = normalizeWebLocale(body?.locale) ?? 'vi'
  const title = String(body?.title ?? '').trim() || reviewTitleTemplate(rating, locale)
  let reviewerName = String(body?.reviewerName ?? '').trim()
  if (!reviewerName) {
    const email = await resolveSiteVisitorEmail(request, shop.partnerId)
    reviewerName = email ? email.split('@')[0] : 'Khách hàng'
  }

  const result = await insertPartnerProductReviewFromPg({
    partnerId: shop.partnerId,
    inventoryId,
    guestAccountId: visitor.thread.guestAccountId,
    linkedUserId: visitor.thread.linkedUserId,
    reviewerName,
    rating,
    title,
    content,
    imageUrls: sanitizeReviewImageUrls(body?.imageUrls),
  })

  if (!result.ok) {
    const status = result.error === 'not_eligible' ? 403 : result.error === 'already_reviewed' ? 409 : 500
    return jsonSitePersonalization(
      request,
      { error: result.error },
      status,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  notifyPartnerOwnerNewReview({
    partnerId: shop.partnerId,
    reviewerName: result.row.reviewerName,
    rating: result.row.rating,
    content: result.row.content,
  }).catch((e) => console.warn('[reviews POST] notify owner', e))

  return jsonSitePersonalization(
    request,
    { ok: true, review: result.row },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}
