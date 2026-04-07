import { NextRequest, NextResponse } from 'next/server'
import { syncPartnerInventoryEmbeddings } from '@/lib/messaging/partner-inventory-embedding'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 600

const PARTNERS_PER_RUN = Math.max(
  1,
  Math.min(50, parseInt(process.env.MESSAGING_INVENTORY_EMBED_CRON_PARTNERS_PER_RUN || '8', 10) || 8)
)
const PARTNER_SCAN_ROWS = Math.max(
  200,
  Math.min(100000, parseInt(process.env.MESSAGING_INVENTORY_EMBED_CRON_SCAN_ROWS || '5000', 10) || 5000)
)
const LIMIT_PER_PARTNER = Math.max(
  20,
  Math.min(5000, parseInt(process.env.MESSAGING_INVENTORY_EMBED_CRON_LIMIT_PER_PARTNER || '400', 10) || 400)
)

function isAuthorized(req: NextRequest): boolean {
  const secret =
    process.env.MESSAGING_INVENTORY_EMBED_CRON_SECRET?.trim() ||
    process.env.MESSAGING_PARTNER_AI_CRON_SECRET?.trim()
  if (!secret) return false
  const auth = req.headers.get('authorization')?.trim()
  return auth === `Bearer ${secret}`
}

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceRoleClient()
  const { data: inventoryRows, error: invErr } = await db
    .from('messaging_partner_inventory')
    .select('partner_id, updated_at')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(PARTNER_SCAN_ROWS)
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  const uniquePartnerIds: string[] = []
  const seen = new Set<string>()
  for (const row of inventoryRows ?? []) {
    const pid = String(row.partner_id ?? '').trim()
    if (!pid || seen.has(pid)) continue
    seen.add(pid)
    uniquePartnerIds.push(pid)
    if (uniquePartnerIds.length >= PARTNERS_PER_RUN) break
  }

  const results: Array<{ partnerId: string; ok: boolean; synced?: number; failed?: number; skipped?: number; error?: string }> = []
  let totalSynced = 0
  let totalFailed = 0
  let totalSkipped = 0

  for (const partnerId of uniquePartnerIds) {
    const one = await syncPartnerInventoryEmbeddings(db, partnerId, { limit: LIMIT_PER_PARTNER, force: false })
    if (!one.ok) {
      results.push({ partnerId, ok: false, error: one.error })
      continue
    }
    totalSynced += one.synced
    totalFailed += one.failed
    totalSkipped += one.skipped
    results.push({
      partnerId,
      ok: true,
      synced: one.synced,
      failed: one.failed,
      skipped: one.skipped,
    })
  }

  return NextResponse.json({
    ok: true,
    partners_scanned: uniquePartnerIds.length,
    limit_per_partner: LIMIT_PER_PARTNER,
    total_synced: totalSynced,
    total_failed: totalFailed,
    total_skipped: totalSkipped,
    results,
  })
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}
