import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { canAutoRunPlan, estimatePlanCredits, planNeedsInputImages } from '@/lib/hub-agent/auto-run-support'
import { runHubPlanAutoWorker, uploadHubAutoRunImages } from '@/lib/hub-agent/hub-agent-worker'
import { pgGetHubMultiTaskPlan, pgQueueHubPlanAutoRun } from '@/lib/db/hub-chat-pg'

export const maxDuration = 300

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const { id: planId } = await ctx.params
  const plan = await pgGetHubMultiTaskPlan(auth.user.id, planId)
  if (!plan) return NextResponse.json({ error: 'Không tìm thấy kế hoạch.' }, { status: 404 })
  if (plan.status !== 'active') {
    return NextResponse.json({ error: 'Kế hoạch không còn hoạt động.' }, { status: 400 })
  }
  if (!canAutoRunPlan(plan.steps)) {
    return NextResponse.json({ error: 'Kế hoạch này chưa hỗ trợ chạy tự động.' }, { status: 400 })
  }
  if (plan.autoRunStatus === 'running' || plan.autoRunStatus === 'queued') {
    return NextResponse.json({ error: 'Kế hoạch đang được chạy tự động.' }, { status: 409 })
  }

  const ct = request.headers.get('content-type') || ''
  let imageQuality: '2K' | '4K' = '2K'
  let inputImages = [...plan.inputImages]

  if (ct.includes('multipart/form-data')) {
    const form = await request.formData()
    const q = String(form.get('imageQuality') || '2K')
    if (q === '4K') imageQuality = '4K'

    const fileBuffers: { buffer: Buffer; mimeType: string }[] = []
    let i = 0
    while (true) {
      const f = form.get(`image_${i}`)
      if (!(f instanceof File) || f.size === 0) break
      fileBuffers.push({
        buffer: Buffer.from(await f.arrayBuffer()),
        mimeType: f.type || 'image/png',
      })
      i++
    }
    if (fileBuffers.length) {
      inputImages = await uploadHubAutoRunImages(auth.user.id, fileBuffers)
    }
  } else {
    const body = (await request.json().catch(() => ({}))) as {
      imageQuality?: string
      inputImages?: string[]
    }
    if (body.imageQuality === '4K') imageQuality = '4K'
    if (Array.isArray(body.inputImages) && body.inputImages.length) {
      inputImages = body.inputImages.map((u) => String(u).trim()).filter(Boolean)
    }
  }

  if (planNeedsInputImages(plan.steps) && !inputImages.length) {
    return NextResponse.json({ error: 'Cần upload ít nhất 1 ảnh sản phẩm.' }, { status: 400 })
  }

  const estimated = estimatePlanCredits(plan.steps, imageQuality)
  await pgQueueHubPlanAutoRun(auth.user.id, planId, {
    inputImages,
    estimatedCredits: estimated,
  })

  const result = await runHubPlanAutoWorker(planId, {
    userId: auth.user.id,
    imageQuality,
    maxSteps: plan.steps.length,
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, plan: result.plan, estimatedCredits: estimated },
      { status: result.plan ? 422 : 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    plan: result.plan,
    estimatedCredits: estimated,
    chargedNote: 'Credits đã trừ theo từng bước tool.',
  })
}
