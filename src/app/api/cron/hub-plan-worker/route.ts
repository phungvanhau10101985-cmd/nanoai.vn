import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { runHubPlanAutoWorkerBatch } from '@/lib/hub-agent/hub-agent-worker'

export const maxDuration = 300
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Cron: xử lý kế hoạch hub auto-run đang queued/running.
 * Authorization: Bearer <HUB_PLAN_WORKER_CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = process.env.HUB_PLAN_WORKER_CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'HUB_PLAN_WORKER_CRON_SECRET chưa cấu hình.' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')?.trim()
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const limit = Math.min(5, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 2))
  try {
    const result = await runHubPlanAutoWorkerBatch(limit)
    return NextResponse.json({ ok: true, cron: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/hub-plan-worker]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
