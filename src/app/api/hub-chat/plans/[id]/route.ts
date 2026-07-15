import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  pgAdvanceHubPlanStep,
  pgCancelHubMultiTaskPlan,
  pgGetHubMultiTaskPlan,
  pgMarkHubStepResult,
} from '@/lib/db/hub-chat-pg'

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, ctx: RouteCtx) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { id } = await ctx.params
  const plan = await pgGetHubMultiTaskPlan(auth.user.id, id)
  if (!plan) return NextResponse.json({ error: 'Không tìm thấy kế hoạch.' }, { status: 404 })
  return NextResponse.json({ ok: true, plan })
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { id } = await ctx.params
  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    resultUrl?: string
    stepIndex?: number
  }

  if (body.action === 'cancel') {
    const ok = await pgCancelHubMultiTaskPlan(auth.user.id, id)
    if (!ok) return NextResponse.json({ error: 'Không hủy được kế hoạch.' }, { status: 400 })
    const plan = await pgGetHubMultiTaskPlan(auth.user.id, id)
    return NextResponse.json({ ok: true, plan })
  }

  if (body.action === 'complete' || body.action === 'skip') {
    const existing = await pgGetHubMultiTaskPlan(auth.user.id, id)
    if (existing && body.resultUrl?.trim() && body.action === 'complete') {
      const idx = body.stepIndex ?? existing.currentStepIndex
      await pgMarkHubStepResult(id, idx, { resultUrl: body.resultUrl.trim() })
    }
    const plan = await pgAdvanceHubPlanStep(auth.user.id, id, body.action)
    if (!plan) return NextResponse.json({ error: 'Không cập nhật được bước.' }, { status: 400 })
    return NextResponse.json({ ok: true, plan })
  }

  return NextResponse.json({ error: 'action không hợp lệ (complete | skip | cancel).' }, { status: 400 })
}
