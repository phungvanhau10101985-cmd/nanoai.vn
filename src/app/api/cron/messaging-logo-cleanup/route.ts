import { NextRequest, NextResponse } from 'next/server'
import { runLogoCleanupCron } from '@/lib/cron/logo-cleanup-cron'
import { isPgConfigured } from '@/lib/db/pool'

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

  const result = await runLogoCleanupCron()
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json(result)
}

export async function GET(req: NextRequest) {
  return POST(req)
}
