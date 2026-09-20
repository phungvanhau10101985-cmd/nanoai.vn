import { NextRequest, NextResponse } from 'next/server'
import { processPendingBunnyDeletesFromPg } from '@/lib/db/messaging-partner-pending-bunny-deletes-pg'
import { bunnyDeleteOnProductDeleteEnabled } from '@/lib/messaging/inventory-bunny-delete'
import { isPgConfigured } from '@/lib/db/pool'

/**
 * Cron dọn object Bunny từ hàng đợi sau khi xóa SP kho — UX 188
 * `GET /api/v1/products/cron/process-pending-bunny-deletes` mỗi 5 phút.
 * GET|POST + Authorization: Bearer <MESSAGING_PARTNER_AI_CRON_SECRET|CRON_SECRET>.
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
  if (!bunnyDeleteOnProductDeleteEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'BUNNY_DELETE_ON_PRODUCT_DELETE=false' })
  }
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'DATABASE_URL not configured.' }, { status: 503 })
  }
  const limitRaw = Number(req.nextUrl.searchParams.get('limit') || '')
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.floor(limitRaw)) : undefined
  try {
    const out = await processPendingBunnyDeletesFromPg(limit)
    return NextResponse.json({ ok: true, ...out })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : ''
    if (code === '42P01') {
      return NextResponse.json({ ok: true, skipped: true, reason: 'table_missing' })
    }
    console.error('[cron/partner-inventory-bunny-delete]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}
