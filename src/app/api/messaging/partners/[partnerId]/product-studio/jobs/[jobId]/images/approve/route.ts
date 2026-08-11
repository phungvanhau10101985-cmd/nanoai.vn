import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { approveProductStudioSlot } from '@/lib/partner-website/product-studio/product-studio-slot-pipeline'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** PS.5 — duyệt ảnh hiện tại: commit vào studio (màu/gallery/chi tiết/chất liệu) + thêm ref pool. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; jobId: string }> }
) {
  const { partnerId, jobId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const result = await approveProductStudioSlot(pid, jobId.trim())
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ job: result.job, done: result.done })
}
