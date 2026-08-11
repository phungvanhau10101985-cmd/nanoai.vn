import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { fetchProductStudioJobByIdPg, updateProductStudioJobPg } from '@/lib/db/messaging-partner-product-studio-jobs-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { publishProductStudioJob } from '@/lib/partner-website/product-studio/product-studio-job-runner'

/** PS.7-PS.9 — đăng sản phẩm (dùng cho mode AI sau khi Studio duyệt xong, hoặc retry publish thủ công). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string; jobId: string }> }) {
  const { partnerId, jobId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as { productName?: string }
  const jid = jobId.trim()
  if (body.productName?.trim()) {
    const job = await fetchProductStudioJobByIdPg(pid, jid)
    if (job) {
      await updateProductStudioJobPg({
        partnerId: pid,
        jobId: jid,
        payload: { ...job.payload, productName: body.productName.trim() },
      })
    }
  }

  const published = await publishProductStudioJob(pid, jid)
  if (!published.ok) return NextResponse.json({ error: published.error }, { status: 400 })
  return NextResponse.json({ ok: true, result: published.result })
}
