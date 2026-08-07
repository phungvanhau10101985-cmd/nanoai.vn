import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  fetchPartnerPromotionsForAdminFromPg,
  insertPartnerPromotionFromPg,
} from '@/lib/db/messaging-partner-promotions-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import type { UpsertPromotionInput } from '@/lib/db/messaging-partner-promotions-pg'

/** M2.2 — danh sách voucher admin + tạo mới. Gate: quyền `marketing_campaigns`. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'marketing_campaigns')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const url = req.nextUrl
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20) || 20))
  const result = await fetchPartnerPromotionsForAdminFromPg({ partnerId: pid, page, pageSize })
  if (result === null) return NextResponse.json({ error: 'Could not load promotions' }, { status: 500 })
  return NextResponse.json({ promotions: result.rows, total: result.total, page, pageSize })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'marketing_campaigns')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as Partial<UpsertPromotionInput>
  if (!body.code?.trim() || !body.name?.trim() || !body.discountType) {
    return NextResponse.json({ error: 'code, name, discountType required' }, { status: 400 })
  }

  const result = await insertPartnerPromotionFromPg(pid, body as UpsertPromotionInput)
  if (!result.ok) {
    const status = result.error === 'duplicate_code' || result.error === 'invalid_code' || result.error === 'invalid_discount' ? 409 : 500
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ success: true, promotion: result.row })
}
