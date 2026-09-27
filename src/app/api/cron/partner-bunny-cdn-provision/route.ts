import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { partnerBunnyAccountConfigured, provisionMissingPartnerBunnyCdns } from '@/lib/storage/partner-bunny-cdn'

/**
 * Cấp ổ CDN Bunny cho shop đã tạo mà chưa có zone.
 * GET|POST + Authorization: Bearer <MESSAGING_PARTNER_AI_CRON_SECRET|CRON_SECRET>.
 * Mặc định 1 shop / lần.
 */
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
  add(process.env.MESSAGING_PARTNER_AI_CRON_SECRET)
  add(process.env.CRON_SECRET)
  if (candidates.size === 0) return false
  return candidates.has(token)
}

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isPgConfigured()) return NextResponse.json({ error: 'DATABASE_URL not configured.' }, { status: 503 })
  if (!partnerBunnyAccountConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'missing BUNNY_ACCOUNT_API_KEY' })
  }
  const limitRaw = Number(req.nextUrl.searchParams.get('limit') || '')
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(5, Math.floor(limitRaw)) : 1
  try {
    const results = await provisionMissingPartnerBunnyCdns(limit)
    return NextResponse.json({
      ok: true,
      count: results.length,
      provisioned: results.filter((row) => row.ok).map((row) => row.slug),
      failed: results.filter((row) => !row.ok).map((row) => ({ slug: row.slug, error: row.error || '' })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'provision failed'
    console.error('[cron/partner-bunny-cdn-provision]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}
