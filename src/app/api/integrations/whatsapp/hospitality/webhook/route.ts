import { NextResponse } from 'next/server'
import { ensureHospitalityConversation } from '@/lib/hospitality/hospitality-conversation-service'
import { fetchMessagingPartnerByIdFromPg } from '@/lib/db/messaging-partners-pg'
import { appendWhatsAppInboundToConversation } from '@/lib/hospitality/whatsapp-connector'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const WEBHOOK_SECRET = (process.env.HOSPITALITY_WHATSAPP_WEBHOOK_SECRET || '').trim()

export async function POST(req: Request) {
  const auth = req.headers.get('x-hospitality-whatsapp-secret')?.trim() ?? ''
  if (!WEBHOOK_SECRET || auth !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: {
    partner_id?: string
    from_phone?: string
    message_id?: string
    text?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }

  const partnerId = String(body.partner_id ?? '').trim()
  const partner = await fetchMessagingPartnerByIdFromPg(partnerId)
  if (!partner || partner.industry_key !== 'hotel') {
    return NextResponse.json({ error: 'PARTNER_NOT_HOSPITALITY' }, { status: 400 })
  }
  const fromPhone = String(body.from_phone ?? '').trim()
  const text = String(body.text ?? '').trim()
  if (!fromPhone || !text) {
    return NextResponse.json({ error: 'MISSING_INPUT' }, { status: 400 })
  }
  const messageId = String(body.message_id ?? '').trim() || `wa_${Date.now()}`
  const conv = await ensureHospitalityConversation({
    partnerId,
    channel: 'internal',
    externalThreadId: fromPhone,
    customerName: fromPhone,
    metadata: { source: 'whatsapp_hospitality_webhook', channel: 'whatsapp' },
  })
  if (!('conversationId' in conv)) {
    return NextResponse.json({ error: conv.error }, { status: 500 })
  }
  const ok = await appendWhatsAppInboundToConversation({
    partner_id: partnerId,
    conversation_id: conv.conversationId,
    external_message_id: messageId,
    text,
    from_phone: fromPhone,
    raw_payload: { source: 'whatsapp_webhook' },
  })
  if (!ok) return NextResponse.json({ error: 'WRITE_FAILED' }, { status: 500 })
  return NextResponse.json({ ok: true, conversation_id: conv.conversationId })
}
