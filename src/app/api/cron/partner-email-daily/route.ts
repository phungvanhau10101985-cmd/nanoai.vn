import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { runPartnerBirthdayPromoBatchAll } from '@/lib/messaging/partner-birthday-promo-batch'
import { runPartnerPromotionMaintenance } from '@/lib/messaging/partner-promotion-auto-grant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')?.trim()
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice('Bearer '.length).trim()
  return [process.env.CRON_SECRET, process.env.MESSAGING_PARTNER_AI_CRON_SECRET]
    .map((s) => s?.trim())
    .filter(Boolean)
    .includes(token)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!isPgConfigured()) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }
  const birthday = await runPartnerBirthdayPromoBatchAll()
  const promotions = await runPartnerPromotionMaintenance()
  return NextResponse.json({ ok: true, birthday, promotions })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
