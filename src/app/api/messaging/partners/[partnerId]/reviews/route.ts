import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  deleteAllPartnerProductReviewsFromPg,
  fetchPartnerProductReviewsForAdminFromPg,
} from '@/lib/db/messaging-partner-reviews-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** M1.2 — danh sách review admin (phân trang 10/dòng, lọc rating) + xoá tất cả (bulk). Gate: `inventory`. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const url = req.nextUrl
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') ?? 10) || 10))
  const ratingRaw = Number(url.searchParams.get('rating') ?? 0)
  const ratingFilter = ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : undefined
  const inventoryId = url.searchParams.get('inventoryId') || undefined
  const groupRaw = url.searchParams.get('importGroup')
  const importGroup =
    groupRaw != null && groupRaw.trim() !== '' && Number.isFinite(Number(groupRaw))
      ? Number(groupRaw)
      : undefined
  const sourceRaw = url.searchParams.get('source')
  const source =
    sourceRaw === 'real' || sourceRaw === 'imported' || sourceRaw === 'all' ? sourceRaw : undefined

  const result = await fetchPartnerProductReviewsForAdminFromPg({
    partnerId: pid,
    page,
    pageSize,
    ratingFilter,
    inventoryId,
    importGroup,
    source,
  })
  if (result === null) return NextResponse.json({ error: 'Could not load reviews' }, { status: 500 })
  return NextResponse.json({ reviews: result.rows, total: result.total, page, pageSize })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const inventoryId = req.nextUrl.searchParams.get('inventoryId') || undefined
  const deleted = await deleteAllPartnerProductReviewsFromPg(pid, inventoryId)
  return NextResponse.json({ success: true, deleted })
}
