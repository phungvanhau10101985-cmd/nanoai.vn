import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import {
  insertProductStudioJobPg,
  listProductStudioJobsPg,
} from '@/lib/db/messaging-partner-product-studio-jobs-pg'
import {
  jsonToProductStudioPayload,
  type ProductStudioJobPayload,
} from '@/lib/partner-website/product-studio/product-studio-types'
import { publishProductStudioJob } from '@/lib/partner-website/product-studio/product-studio-job-runner'

/** PS.3/PS.10 — danh sách job đang dở (sống sót refresh) + tạo job mới (mode thủ công publish ngay). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const activeOnly = req.nextUrl.searchParams.get('active') !== 'false'
  const jobs = await listProductStudioJobsPg(pid, { activeOnly, limit: 20 })
  return NextResponse.json({ jobs })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as { payload?: unknown }
  const payload: ProductStudioJobPayload = jsonToProductStudioPayload((body.payload ?? {}) as never)

  const job = await insertProductStudioJobPg({
    partnerId: pid,
    createdBy: auth.user.id,
    mode: payload.mode,
    payload,
    status: payload.mode === 'manual' ? 'publishing' : 'draft',
    step: payload.mode === 'manual' ? 'create_product' : 'awaiting_studio',
  })
  if (!job) return NextResponse.json({ error: 'Could not create job' }, { status: 500 })

  if (payload.mode === 'manual') {
    const published = await publishProductStudioJob(pid, job.id)
    if (!published.ok) {
      return NextResponse.json({ error: published.error, jobId: job.id }, { status: 400 })
    }
    return NextResponse.json({ ok: true, jobId: job.id, result: published.result })
  }

  return NextResponse.json({ ok: true, jobId: job.id, job })
}
