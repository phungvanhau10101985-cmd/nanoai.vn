import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  deletePartnerProductReviewFromPg,
  updatePartnerProductReviewFromPg,
} from '@/lib/db/messaging-partner-reviews-pg'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** M1.2 — inline auto-save (is_active/rating/title/content/merchant_reply) + xoá từng dòng. Gate: `inventory`. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; reviewId: string }> }
) {
  const { partnerId, reviewId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as {
    isActive?: boolean
    rating?: number
    title?: string
    content?: string
    merchantReply?: string
    merchantReplyBy?: string
    reviewerName?: string
    usefulCount?: number
    importGroup?: number
  }

  if (body.merchantReply !== undefined && body.merchantReply.trim() && !body.merchantReplyBy?.trim()) {
    const partners = await fetchMessagingPartnersByIdsFromPg([pid])
    body.merchantReplyBy = partners?.[0]?.display_name?.trim() || 'Shop'
  }

  const row = await updatePartnerProductReviewFromPg(pid, reviewId, body)
  if (!row) return NextResponse.json({ error: 'Could not update review' }, { status: 500 })
  return NextResponse.json({ success: true, review: row })
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; reviewId: string }> }
) {
  const { partnerId, reviewId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const ok = await deletePartnerProductReviewFromPg(pid, reviewId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
