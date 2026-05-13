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

  for (const partnerId of partnerIds) {
    const outcome = await runPartnerExternalCatalogSyncJob({
      partnerId,
      deferEmbeddings: true,
      reportSource: 'cron',
    })
    results.push({ partnerId, outcome })
  }

  return NextResponse.json({
    ok: true,
    partners_run: partnerIds.length,
    results,
  })
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}
