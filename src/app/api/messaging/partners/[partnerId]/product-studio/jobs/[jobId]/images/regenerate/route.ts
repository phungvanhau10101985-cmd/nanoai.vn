import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { fetchProductStudioJobByIdPg } from '@/lib/db/messaging-partner-product-studio-jobs-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { generateProductStudioSlot } from '@/lib/partner-website/product-studio/product-studio-slot-pipeline'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** PS.5 — tạo lại slot HIỆN TẠI (chưa duyệt) — có thể sửa prompt/ảnh tham khảo. */
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

  const job = await fetchProductStudioJobByIdPg(pid, jobId.trim())
  if (!job?.studio.currentSlot) return NextResponse.json({ error: 'no_active_slot' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as { customPrompt?: string; refUrls?: string[] }
  const result = await generateProductStudioSlot(pid, jobId.trim(), {
    kind: job.studio.currentSlot.kind,
    name: job.studio.currentSlot.name,
    customPrompt: body.customPrompt,
    refUrlsOverride: Array.isArray(body.refUrls) && body.refUrls.length ? body.refUrls : undefined,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ job: result.job })
}
