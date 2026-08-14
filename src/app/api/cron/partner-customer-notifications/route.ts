import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import {
  deleteExpiredPartnerCustomerNotificationsFromPg,
  listPendingPartnerNotificationEmailsFromPg,
  listPendingPartnerNotificationPushesFromPg,
} from '@/lib/db/messaging-partner-customer-notifications-pg'
import { deliverPendingPartnerNotificationEmail } from '@/lib/messaging/partner-customer-notification-email'
import { deliverPendingPartnerNotificationPush } from '@/lib/messaging/partner-customer-notification-push'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 180

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
  add(process.env.MESSAGING_PARTNER_MARKETING_CRON_SECRET)
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

  const expired = await deleteExpiredPartnerCustomerNotificationsFromPg()
  const pending = await listPendingPartnerNotificationEmailsFromPg({ limit: 40 })
  let sent = 0
  let skipped = 0
  let failed = 0
  for (const row of pending) {
    const status = await deliverPendingPartnerNotificationEmail(row)
    if (status === 'sent') sent += 1
    else if (status === 'skipped') skipped += 1
    else failed += 1
  }

  const pendingPush = await listPendingPartnerNotificationPushesFromPg({ limit: 40 })
  let pushSent = 0
  let pushSkipped = 0
  let pushFailed = 0
  for (const row of pendingPush) {
    const status = await deliverPendingPartnerNotificationPush(row)
    if (status === 'sent') pushSent += 1
    else if (status === 'skipped') pushSkipped += 1
    else pushFailed += 1
  }

  return NextResponse.json({
    ok: true,
    expired,
    pending: pending.length,
    sent,
    skipped,
    failed,
    pushPending: pendingPush.length,
    pushSent,
    pushSkipped,
    pushFailed,
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
