import { NextRequest, NextResponse } from 'next/server'
import {
  deleteExpiredInactiveLogoVersionsFromPg,
  listExpiredInactiveLogoVersionUrlsFromPg,
} from '@/lib/db/messaging-partner-logo-versions-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { removeTryOnStorageObjects, tryOnPublicUrlToStoragePath } from '@/lib/storage/try-on-public-upload'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')?.trim()
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice('Bearer '.length).trim()
  const candidates = new Set<string>()
  const add = (s: string | undefined) => {
    const t = s?.trim()
    if (t) candidates.add(t)
  }
  add(process.env.MESSAGING_LOGO_CLEANUP_CRON_SECRET)
  add(process.env.MESSAGING_PARTNER_AI_CRON_SECRET)
  add(process.env.CRON_SECRET)
  if (candidates.size === 0) return false
  return candidates.has(token)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPgConfigured()) return NextResponse.json({ error: 'DATABASE_URL not configured.' }, { status: 503 })

  const daysRaw = parseInt(process.env.MESSAGING_LOGO_UNUSED_DELETE_DAYS || '3', 10)
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(30, daysRaw)) : 3
  const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const urls = await listExpiredInactiveLogoVersionUrlsFromPg(cutoffIso)
  if (urls === null) return NextResponse.json({ error: 'Failed to load expired logos.' }, { status: 500 })

  const paths = [...new Set(urls.map((u) => tryOnPublicUrlToStoragePath(u)).filter((p): p is string => Boolean(p)))]
  if (paths.length > 0) {
    await removeTryOnStorageObjects(paths)
  }

  const deleted = await deleteExpiredInactiveLogoVersionsFromPg(cutoffIso)
  if (deleted === null) return NextResponse.json({ error: 'Failed to delete expired logo versions.' }, { status: 500 })

  return NextResponse.json({
    ok: true,
    retentionDays: days,
    candidates: urls.length,
    deletedRows: deleted,
    deletedFiles: paths.length,
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
