import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { fetchPartnerCustomersForAdminFromPg } from '@/lib/db/messaging-partner-customers-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** M2.1 — danh sách khách hàng (CRM nhẹ): ai đã mua, tổng chi tiêu, lịch sử đơn. Gate: quyền `orders`. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'orders')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const url = req.nextUrl
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20) || 20))
  const search = url.searchParams.get('search') || undefined

  const result = await fetchPartnerCustomersForAdminFromPg({ partnerId: pid, page, pageSize, search })
  if (result === null) return NextResponse.json({ error: 'Could not load customers' }, { status: 500 })
  return NextResponse.json({ customers: result.rows, total: result.total, page, pageSize })
}
