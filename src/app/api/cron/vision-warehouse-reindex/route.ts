import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { processVisionWarehouseReindexCron } from '@/lib/messaging/partner-vision-warehouse-runner'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Cron VPS: analyze corpus + rebuild index sau khi import Vision Warehouse.
 * Dùng chung secret với vision-catalog-sync hoặc đặt VISION_WAREHOUSE_REINDEX_CRON_SECRET.
 * Gợi ý: mỗi 2–5 phút.
 */
async function handleCron(req: NextRequest) {
  const secret =
    process.env.VISION_WAREHOUSE_REINDEX_CRON_SECRET?.trim() ||
    process.env.VISION_CATALOG_SYNC_CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json(
      { error: 'VISION_WAREHOUSE_REINDEX_CRON_SECRET or VISION_CATALOG_SYNC_CRON_SECRET not configured.' },
      { status: 503 }
    )
  }
  const auth = req.headers.get('authorization')?.trim()
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = createServiceRoleClient()
    const r = await processVisionWarehouseReindexCron(db)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    console.error('[cron/vision-warehouse-reindex]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}
