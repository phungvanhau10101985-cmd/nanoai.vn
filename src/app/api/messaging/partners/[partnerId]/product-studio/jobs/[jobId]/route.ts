import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import {
  deleteProductStudioJobPg,
  fetchProductStudioJobByIdPg,
} from '@/lib/db/messaging-partner-product-studio-jobs-pg'

/** PS.10 — poll trạng thái job (studio slot đang tạo/đã xong) + discard job dở. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string; jobId: string }> }) {
  const { partnerId, jobId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const job = await fetchProductStudioJobByIdPg(pid, jobId.trim())
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  return NextResponse.json({ job })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ partnerId: string; jobId: string }> }) {
  const { partnerId, jobId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const ok = await deleteProductStudioJobPg(pid, jobId.trim())
  if (!ok) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
