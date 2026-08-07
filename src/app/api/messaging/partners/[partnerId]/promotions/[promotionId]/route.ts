import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  deletePartnerPromotionFromPg,
  updatePartnerPromotionFromPg,
  type UpsertPromotionInput,
} from '@/lib/db/messaging-partner-promotions-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** M2.2 — sửa/xoá 1 voucher. Gate: quyền `marketing_campaigns`. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; promotionId: string }> }
) {
  const { partnerId, promotionId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'marketing_campaigns')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as Partial<UpsertPromotionInput>
  const result = await updatePartnerPromotionFromPg(pid, promotionId, body)
  if (!result.ok) {
    const status = result.error === 'duplicate_code' || result.error === 'invalid_code' || result.error === 'invalid_discount' ? 409 : 500
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ success: true, promotion: result.row })
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; promotionId: string }> }
) {
  const { partnerId, promotionId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'marketing_campaigns')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const ok = await deletePartnerPromotionFromPg(pid, promotionId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
