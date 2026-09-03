import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerIdsDueForExternalCatalogSyncFromPg } from '@/lib/db/messaging-partner-inventory-external-sync-pg'
import { isPgConfigured } from '@/lib/db/pool'
import {
  runPartnerExternalCatalogSyncJob,
  type ExternalCatalogSyncOutcome,
} from '@/lib/messaging/partner-inventory-external-catalog-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 600

const PARTNERS_PER_RUN = Math.max(
  1,
  Math.min(
    20,
    parseInt(process.env.MESSAGING_EXTERNAL_CATALOG_CRON_PARTNERS_PER_RUN || '6', 10) || 6
  )
)

/**
 * Ngân sách thời gian cho cả route (< `maxDuration` 600s) — kho lớn (~100k SP) có thể mất vài phút/shop
 * dù đã tải song song. Cron mặc định **1 lần/ngày** (03:05 VN). Shop chỉ chạy khi đã tới
 * `catalog_auto_sync_time_vn` và chưa sync trong ngày. Dừng nhận thêm partner khi gần hết ngân sách.
 */
const RUN_TIME_BUDGET_MS = 560_000

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')?.trim()
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice('Bearer '.length).trim()
  const candidates = new Set<string>()
  const add = (s: string | undefined) => {
    const t = s?.trim()
    if (t) candidates.add(t)
  }
  add(process.env.MESSAGING_EXTERNAL_CATALOG_CRON_SECRET)
  add(process.env.MESSAGING_INVENTORY_EMBED_CRON_SECRET)
  add(process.env.MESSAGING_PARTNER_AI_CRON_SECRET)
  add(process.env.CRON_SECRET)
  if (candidates.size === 0) return false
  return candidates.has(token)
}

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isPgConfigured()) {
    return NextResponse.json(
      { error: 'DATABASE_URL not configured — external catalog sync cron requires Postgres.' },
      { status: 503 }
    )
  }

  const partnerIds = await fetchPartnerIdsDueForExternalCatalogSyncFromPg(PARTNERS_PER_RUN)
  const results: Array<{ partnerId: string; outcome: ExternalCatalogSyncOutcome }> = []
  const startedAt = Date.now()
  let skippedForBudget = 0

  for (const partnerId of partnerIds) {
    if (Date.now() - startedAt > RUN_TIME_BUDGET_MS) {
      skippedForBudget += 1
      continue
    }
    const outcome = await runPartnerExternalCatalogSyncJob({
      partnerId,
      deferEmbeddings: true,
      reportSource: 'cron',
    })
    results.push({ partnerId, outcome })
  }

  return NextResponse.json({
    ok: true,
    partners_run: results.length,
    partners_deferred_next_run: skippedForBudget,
    results,
  })
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}
