import { NextRequest, NextResponse } from 'next/server'
import { runPartnerCustomDomainSslWorker } from '@/lib/messaging/partner-custom-domain-ssl-worker'

/**
 * Cron: cấp SSL + nginx cho tên miền shop (dns_ok) trên VPS self-host.
 * GET/POST + Authorization: Bearer <PARTNER_DOMAIN_SSL_CRON_SECRET>
 *
 * Cần trên VPS:
 * - PARTNER_DOMAIN_SSL_AUTO_PROVISION=1
 * - deploy/provision-partner-domain-ssl.sh (chạy được sudo certbot)
 * - Crontab mỗi 3 phút (xem deploy/update-vps.sh)
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function readCronSecret(): string | null {
  return (
    process.env.PARTNER_DOMAIN_SSL_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  )
}

async function handleCron(req: NextRequest) {
  const secret = readCronSecret()
  if (!secret) {
    return NextResponse.json({ error: 'PARTNER_DOMAIN_SSL_CRON_SECRET not configured.' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')?.trim()
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limitRaw = req.nextUrl.searchParams.get('limit')
  const limit = limitRaw ? Math.min(20, Math.max(1, parseInt(limitRaw, 10) || 5)) : 5

  try {
    const stats = await runPartnerCustomDomainSslWorker(limit)
    return NextResponse.json({ ok: true, ...stats })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    console.error('[cron/partner-custom-domain-ssl]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}
