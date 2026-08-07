import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  fetchPartnerRevenueByDayFromPg,
  fetchPartnerRevenueByUtmSourceFromPg,
  fetchPartnerRevenueSummaryFromPg,
  fetchPartnerTopProductsByRevenueFromPg,
} from '@/lib/db/messaging-partner-revenue-analytics-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const toIso = (d: Date) => d.toISOString().slice(0, 10)
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  return { dateFrom: toIso(from), dateTo: toIso(now) }
}

/** S0.8 — dashboard doanh thu/conversion/UTM. Gate: quyền `orders`. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'orders')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const url = req.nextUrl
  const defaults = defaultDateRange()
  const dateFromRaw = url.searchParams.get('dateFrom') ?? ''
  const dateToRaw = url.searchParams.get('dateTo') ?? ''
  const dateFrom = DATE_RE.test(dateFromRaw) ? dateFromRaw : defaults.dateFrom
  const dateTo = DATE_RE.test(dateToRaw) ? dateToRaw : defaults.dateTo

  const [summary, byDay, byUtmSource, topProducts] = await Promise.all([
    fetchPartnerRevenueSummaryFromPg({ partnerId: pid, dateFrom, dateTo }),
    fetchPartnerRevenueByDayFromPg({ partnerId: pid, dateFrom, dateTo }),
    fetchPartnerRevenueByUtmSourceFromPg({ partnerId: pid, dateFrom, dateTo }),
    fetchPartnerTopProductsByRevenueFromPg({ partnerId: pid, dateFrom, dateTo, limit: 10 }),
  ])

  if (summary === null) return NextResponse.json({ error: 'Could not load analytics' }, { status: 500 })

  return NextResponse.json({
    dateFrom,
    dateTo,
    summary,
    byDay: byDay ?? [],
    byUtmSource: byUtmSource ?? [],
    topProducts: topProducts ?? [],
  })
}
