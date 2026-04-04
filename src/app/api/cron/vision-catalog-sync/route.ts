import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { processVisionCatalogBackgroundSyncJobs } from '@/lib/messaging/partner-vision-bg-sync-cron'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 660

/**
 * Cron VPS: đồng bộ Vision catalog nền (queued/running).
 * GET hoặc POST + Authorization: Bearer <VISION_CATALOG_SYNC_CRON_SECRET>
 * Gợi ý crontab mỗi 1–3 phút.
 */
async function handleCron(req: NextRequest) {
  const secret = process.env.VISION_CATALOG_SYNC_CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'VISION_CATALOG_SYNC_CRON_SECRET not configured.' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')?.trim()
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = createServiceRoleClient()
    const stats = await processVisionCatalogBackgroundSyncJobs(db)
    return NextResponse.json({ ok: true, ...stats })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    console.error('[cron/vision-catalog-sync]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}
