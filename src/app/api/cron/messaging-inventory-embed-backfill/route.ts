import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerIdsSyncedCatalogTodayVnFromPg } from '@/lib/db/messaging-partner-inventory-external-sync-pg'
import { fetchActivePartnerInventoryScanRowsFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { syncPartnerInventoryEmbeddings } from '@/lib/messaging/partner-inventory-embedding'
import { syncPartnerInventoryTextEmbeddings } from '@/lib/messaging/partner-inventory-text-embedding'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 600

const PARTNERS_PER_RUN = Math.max(
  1,
  Math.min(20, parseInt(process.env.MESSAGING_INVENTORY_EMBED_CRON_PARTNERS_PER_RUN || '12', 10) || 12)
)
const PARTNER_SCAN_ROWS = Math.max(
  200,
  Math.min(100000, parseInt(process.env.MESSAGING_INVENTORY_EMBED_CRON_SCAN_ROWS || '5000', 10) || 5000)
)
const LIMIT_PER_PARTNER = Math.max(
  20,
  Math.min(1000, parseInt(process.env.MESSAGING_INVENTORY_EMBED_CRON_LIMIT_PER_PARTNER || '200', 10) || 200)
)
/** Dưới maxDuration 600s — lặp batch đến hết SP thiếu vector (đã có thì bỏ qua). */
const RUN_TIME_BUDGET_MS = 540_000

type EmbedCronGlobal = typeof globalThis & {
  __messagingInventoryEmbedCronRunning?: boolean
  __messagingInventoryEmbedCronStartedAt?: number
}

const EMBED_CRON_STALE_MS = 12 * 60 * 1000

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')?.trim()
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice('Bearer '.length).trim()
  const candidates = new Set<string>()
  const add = (s: string | undefined) => {
    const t = s?.trim()
    if (t) candidates.add(t)
  }
  add(process.env.MESSAGING_INVENTORY_EMBED_CRON_SECRET)
  add(process.env.MESSAGING_PARTNER_AI_CRON_SECRET)
  /** Vercel Cron gửi Authorization: Bearer <CRON_SECRET> khi biến CRON_SECRET đã set trong project. */
  add(process.env.CRON_SECRET)
  if (candidates.size === 0) return false
  return candidates.has(token)
}

async function collectPartnerIds(): Promise<string[] | null> {
  const todaySynced = await fetchPartnerIdsSyncedCatalogTodayVnFromPg(PARTNERS_PER_RUN)
  const inventoryRows = await fetchActivePartnerInventoryScanRowsFromPg(PARTNER_SCAN_ROWS)
  if (inventoryRows === null && todaySynced.length === 0) return null

  const uniquePartnerIds: string[] = []
  const seen = new Set<string>()
  for (const pid of todaySynced) {
    if (!pid || seen.has(pid)) continue
    seen.add(pid)
    uniquePartnerIds.push(pid)
    if (uniquePartnerIds.length >= PARTNERS_PER_RUN) return uniquePartnerIds
  }
  for (const row of inventoryRows ?? []) {
    const pid = String(row.partner_id ?? '').trim()
    if (!pid || seen.has(pid)) continue
    seen.add(pid)
    uniquePartnerIds.push(pid)
    if (uniquePartnerIds.length >= PARTNERS_PER_RUN) break
  }
  return uniquePartnerIds
}

async function embedPartnerUntilDone(
  partnerId: string,
  startedAt: number
): Promise<{
  ok: boolean
  synced?: number
  failed?: number
  skipped?: number
  error?: string
  batches?: number
}> {
  let synced = 0
  let failed = 0
  let skipped = 0
  let batches = 0
  while (Date.now() - startedAt < RUN_TIME_BUDGET_MS) {
    const one = await syncPartnerInventoryEmbeddings(partnerId, { limit: LIMIT_PER_PARTNER, force: false })
    if (!one.ok) return { ok: false, error: one.error, synced, failed, skipped, batches }
    const oneText = await syncPartnerInventoryTextEmbeddings(partnerId, {
      limit: LIMIT_PER_PARTNER,
      force: false,
    })
    if (!oneText.ok) return { ok: false, error: oneText.error, synced, failed, skipped, batches }
    batches += 1
    synced += one.synced + oneText.synced
    failed += one.failed + oneText.failed
    skipped += one.skipped + oneText.skipped
    const pending = one.synced + one.failed + oneText.synced + oneText.failed
    if (pending === 0) break
  }
  return { ok: true, synced, failed, skipped, batches }
}

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isPgConfigured()) {
    return NextResponse.json(
      { error: 'DATABASE_URL not configured — inventory embed cron requires Postgres.' },
      { status: 503 }
    )
  }

  const g = globalThis as EmbedCronGlobal
  const startedAtLock = g.__messagingInventoryEmbedCronStartedAt ?? 0
  if (g.__messagingInventoryEmbedCronRunning) {
    if (Date.now() - startedAtLock < EMBED_CRON_STALE_MS) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'already_running',
        started_at: startedAtLock || null,
      })
    }
  }
  g.__messagingInventoryEmbedCronRunning = true
  g.__messagingInventoryEmbedCronStartedAt = Date.now()
  const startedAt = Date.now()

  try {
    const uniquePartnerIds = await collectPartnerIds()
    if (uniquePartnerIds === null) {
      return NextResponse.json({ error: 'Failed to load inventory partners from database.' }, { status: 500 })
    }

    const results: Array<{
      partnerId: string
      ok: boolean
      synced?: number
      failed?: number
      skipped?: number
      error?: string
      batches?: number
    }> = []
    let totalSynced = 0
    let totalFailed = 0
    let totalSkipped = 0

    for (const partnerId of uniquePartnerIds) {
      if (Date.now() - startedAt >= RUN_TIME_BUDGET_MS) break
      const one = await embedPartnerUntilDone(partnerId, startedAt)
      results.push({ partnerId, ...one })
      totalSynced += one.synced ?? 0
      totalFailed += one.failed ?? 0
      totalSkipped += one.skipped ?? 0
    }

    return NextResponse.json({
      ok: true,
      partners_scanned: uniquePartnerIds.length,
      limit_per_batch: LIMIT_PER_PARTNER,
      total_synced: totalSynced,
      total_failed: totalFailed,
      total_skipped: totalSkipped,
      results,
    })
  } finally {
    g.__messagingInventoryEmbedCronRunning = false
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}
