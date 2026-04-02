import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { runMessagingPartnerAiJobBatch } from '@/lib/messaging/partner-ai-run-jobs'

/**
 * Cron: xử lý job trả lời AI sau delay (FAQ trong job hoặc DeepSeek).
 * GET hoặc POST + Authorization: Bearer <MESSAGING_PARTNER_AI_CRON_SECRET>
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

  try {
    const db = createServiceRoleClient()
    const stats = await runMessagingPartnerAiJobBatch(db, 15)
    return NextResponse.json({ ok: true, ...stats })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    console.error('[cron/messaging-partner-ai]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}
