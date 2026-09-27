import { NextRequest, NextResponse } from 'next/server'
import { finalizeDueMessagingPartnerPurgesFromPg } from '@/lib/db/messaging-partner-purge-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { destroyPartnerBunnyCdn, retryPendingPartnerBunnyCdnDeletes } from '@/lib/storage/partner-bunny-cdn'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')?.trim()
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice('Bearer '.length).trim()
  const candidates = new Set<string>()
  const add = (s: string | undefined) => {
    const t = s?.trim()
    if (t) candidates.add(t)
  }
  add(process.env.MESSAGING_PARTNER_PURGE_CRON_SECRET)
  add(process.env.CRON_SECRET)
  if (candidates.size === 0) return false
  return candidates.has(token)
}

/** Hoàn tất xóa mềm workspace đến hạn (`purge_at` <= now). */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPgConfigured()) return NextResponse.json({ error: 'DATABASE_URL not configured.' }, { status: 503 })

  const ids = await finalizeDueMessagingPartnerPurgesFromPg()
  let bunnyDeleted = 0
  for (const id of ids) {
    try {
      if (await destroyPartnerBunnyCdn(id)) bunnyDeleted += 1
    } catch (e) {
      console.warn('[cron/messaging-partner-purge] bunny', id, e)
    }
  }
  const bunnyRetried = await retryPendingPartnerBunnyCdnDeletes().catch((e) => {
    console.warn('[cron/messaging-partner-purge] bunny retry', e)
    return 0
  })
  return NextResponse.json({
    ok: true,
    deactivatedPartnerIds: ids,
    count: ids.length,
    bunnyDeleted,
    bunnyRetried,
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
