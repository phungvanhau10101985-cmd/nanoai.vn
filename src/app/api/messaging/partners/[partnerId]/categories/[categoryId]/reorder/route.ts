import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { reorderPartnerCategorySiblingFromPg } from '@/lib/db/messaging-partner-categories-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** W4.4 — sắp xếp thật trong dashboard: đổi vị trí với anh em liền kề (lên/xuống). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; categoryId: string }> }
) {
  const { partnerId, categoryId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as { direction?: string }
  const direction = body.direction === 'up' || body.direction === 'down' ? body.direction : null
  if (!direction) return NextResponse.json({ error: 'invalid direction' }, { status: 400 })

  const ok = await reorderPartnerCategorySiblingFromPg(pid, categoryId.trim(), direction)
  if (!ok) return NextResponse.json({ error: 'reorder_failed' }, { status: 400 })
  return NextResponse.json({ success: true })
}
