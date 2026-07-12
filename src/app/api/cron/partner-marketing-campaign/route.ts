import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { runPartnerMarketingCampaignBatch } from '@/lib/messaging/partner-marketing-run-jobs'

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
  add(process.env.CRON_SECRET)
  add(process.env.MESSAGING_PARTNER_AI_CRON_SECRET)
  if (candidates.size === 0) return false
  return candidates.has(token)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!isPgConfigured()) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const result = await runPartnerMarketingCampaignBatch()
  return NextResponse.json({ ok: true, ...result })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
