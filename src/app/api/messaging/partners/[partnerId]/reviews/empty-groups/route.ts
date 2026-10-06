import { NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { listRatingGroupsWithoutImportedReviewsFromPg } from '@/lib/db/messaging-partner-reviews-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** Nhóm đánh giá đã cấp cho danh mục mới nhưng chưa có đánh giá tạo sẵn. */
export async function GET(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website_reviews')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const groups = await listRatingGroupsWithoutImportedReviewsFromPg(pid)
  return NextResponse.json({ groups })
}
