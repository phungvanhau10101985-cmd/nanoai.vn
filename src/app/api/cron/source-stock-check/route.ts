import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { resumeSourceStockAfterRestart } from '@/lib/messaging/source-stock-check/worker'

/**
 * Khởi động / giữ daemon kiểm tra nguồn sau restart PM2.
 * GET|POST + Authorization: Bearer <MESSAGING_PARTNER_AI_CRON_SECRET>.
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
    const out = await resumeSourceStockAfterRestart()
    return NextResponse.json({ ok: true, ...out })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    console.error('[cron/source-stock-check]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}
