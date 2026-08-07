import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  deletePartnerProductQuestionFromPg,
  updatePartnerProductQuestionFromPg,
} from '@/lib/db/messaging-partner-reviews-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** M1.3 — inline auto-save câu hỏi (is_active/content) + xoá từng dòng (không có xoá hàng loạt). */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; questionId: string }> }
) {
  const { partnerId, questionId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as { isActive?: boolean; content?: string }
  const row = await updatePartnerProductQuestionFromPg(pid, questionId, body)
  if (!row) return NextResponse.json({ error: 'Could not update question' }, { status: 500 })
  return NextResponse.json({ success: true, question: row })
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; questionId: string }> }
) {
  const { partnerId, questionId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const ok = await deletePartnerProductQuestionFromPg(pid, questionId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
