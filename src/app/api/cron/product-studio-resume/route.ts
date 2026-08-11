import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { listStuckProductStudioJobsPg } from '@/lib/db/messaging-partner-product-studio-jobs-pg'
import { resumeStuckProductStudioJob } from '@/lib/partner-website/product-studio/product-studio-job-runner'

/**
 * PS.2 — cron phục hồi job Product Studio kẹt ở generating/publishing (crash/restart giữa chừng),
 * mirror `/api/cron/messaging-partner-ai`. GET hoặc POST + Authorization: Bearer <MESSAGING_PARTNER_AI_CRON_SECRET>.
 */
async function handleCron(req: NextRequest) {
  const secret = process.env.MESSAGING_PARTNER_AI_CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'MESSAGING_PARTNER_AI_CRON_SECRET not configured.' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')?.trim()
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'DATABASE_URL not configured.' }, { status: 503 })
  }

  try {
    const stuck = await listStuckProductStudioJobsPg(10, 20)
    let resumed = 0
    for (const job of stuck) {
      try {
        await resumeStuckProductStudioJob(job)
        resumed += 1
      } catch (e) {
        console.warn('[cron/product-studio-resume] resume failed', job.id, e)
      }
    }
    return NextResponse.json({ ok: true, found: stuck.length, resumed })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    console.error('[cron/product-studio-resume]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}
