import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { runPartnerPromotionMaintenance } from '@/lib/messaging/partner-promotion-auto-grant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest): boolean {
  const header = request.headers.get('authorization')?.trim() ?? ''
  if (!header.startsWith('Bearer ')) return false
  const token = header.slice('Bearer '.length).trim()
  return [process.env.CRON_SECRET, process.env.MESSAGING_PARTNER_AI_CRON_SECRET]
    .map((value) => value?.trim())
    .filter(Boolean)
    .includes(token)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!isPgConfigured()) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }
  const result = await runPartnerPromotionMaintenance()
  return NextResponse.json({ ok: true, ...result })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
