import { NextResponse } from 'next/server'
import { requireHospitalityPartnerOwner } from '@/lib/hospitality/hospitality-partner-auth'
import {
  insertHospitalityPartnerOutboundMessage,
  listHospitalityPartnerConversationMessages,
} from '@/lib/hospitality/hospitality-conversation-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ partnerId: string; conversationId: string }> }
) {
  const { partnerId, conversationId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const bundle = await listHospitalityPartnerConversationMessages(partnerId, conversationId)
  if (bundle === null) return NextResponse.json({ error: 'LOAD_MESSAGES_FAILED' }, { status: 500 })
  if (bundle === 'not_found') return NextResponse.json({ error: 'CONVERSATION_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true, messages: bundle.rows })
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ partnerId: string; conversationId: string }> }
) {
  const { partnerId, conversationId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  let body: { body?: string }
  try {
    body = (await req.json()) as { body?: string }
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }
  const text = String(body.body ?? '').trim()
  if (!text) return NextResponse.json({ error: 'EMPTY_MESSAGE' }, { status: 400 })

  const out = await insertHospitalityPartnerOutboundMessage({
    partnerId,
    conversationId,
    body: text,
    senderAdminId: gate.userId,
  })
  if (!out || 'error' in out) {
    return NextResponse.json({ error: out && 'error' in out ? out.error : 'SEND_FAILED' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, message_id: out.messageId })
}

