import { NextRequest, NextResponse } from 'next/server'
import {
  fetchDuePartnerMetaCapiOutboxFromPg,
  markPartnerMetaCapiOutboxRetryFromPg,
  markPartnerMetaCapiOutboxSentFromPg,
} from '@/lib/db/messaging-partner-meta-capi-outbox-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { sendMetaConversionsApiBatch } from '@/lib/tracking/meta-view-content'

export const dynamic = 'force-dynamic'

/**
 * S0.3 — retry pending Meta CAPI outbox rows.
 * Protect with CRON_SECRET (Authorization: Bearer …) when set.
 */
export async function POST(req: NextRequest) {
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const secret = process.env.CRON_SECRET?.trim()
  if (secret) {
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const due = await fetchDuePartnerMetaCapiOutboxFromPg(25)
  let sent = 0
  let failed = 0
  for (const row of due) {
    const p = row.payload
    const ev = p.event as
      | {
          event_name: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase'
          event_id: string
          custom_data: Record<string, unknown>
        }
      | undefined
    if (!ev || !p.pixelId || !p.accessToken) {
      await markPartnerMetaCapiOutboxRetryFromPg(row.id, row.attempts, 'invalid_payload')
      failed += 1
      continue
    }
    const result = await sendMetaConversionsApiBatch({
      pixelId: String(p.pixelId),
      accessToken: String(p.accessToken),
      eventSourceUrl: String(p.eventSourceUrl ?? ''),
      clientIp: (p.clientIp as string | null) ?? null,
      userAgent: (p.userAgent as string | null) ?? null,
      fbc: (p.fbc as string | null) ?? null,
      fbp: (p.fbp as string | null) ?? null,
      customerEmail: (p.customerEmail as string | null) ?? null,
      customerPhone: (p.customerPhone as string | null) ?? null,
      events: [
        {
          event_name: ev.event_name,
          event_id: ev.event_id,
          custom_data: ev.custom_data as never,
        },
      ],
    })
    if (result.ok) {
      await markPartnerMetaCapiOutboxSentFromPg(row.id)
      sent += 1
    } else {
      await markPartnerMetaCapiOutboxRetryFromPg(row.id, row.attempts, result.error)
      failed += 1
    }
  }

  return NextResponse.json({ ok: true, processed: due.length, sent, failed })
}
