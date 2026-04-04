import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireMessagingPartnerOwner } from '@/lib/messaging/partner-inventory-route-auth'
import { processVisionCatalogBackgroundSyncJobs } from '@/lib/messaging/partner-vision-bg-sync-cron'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 660

/**
 * Chủ shop: chạy một lượt xử lý giống cron `/api/cron/vision-catalog-sync` (không cần Bearer secret).
 * Hữu ích khi VPS chưa cấu hình crontab nhưng job đã «queued».
 */
export async function POST(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireMessagingPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const db = createServiceRoleClient()
  const { data: row, error: selErr } = await db
    .from('messaging_partner_ai_settings')
    .select('vision_bg_sync_status')
    .eq('partner_id', partnerId)
    .maybeSingle()

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })
  if (!row) {
    return NextResponse.json({ error: 'Save AI settings once before background sync.' }, { status: 400 })
  }
  if (row.vision_bg_sync_status !== 'queued' && row.vision_bg_sync_status !== 'running') {
    return NextResponse.json({ error: 'No background job is queued or running.' }, { status: 400 })
  }

  try {
    const stats = await processVisionCatalogBackgroundSyncJobs(db)
    revalidatePath('/dashboard/messaging')
    return NextResponse.json({ ok: true, ...stats })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    console.error('[vision-bg-sync/run-once]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
