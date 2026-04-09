import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { ensureConversation, insertMessage } from '@/lib/customer-care/conversation-service'
import {
  fetchInternalConversationForUserPg,
  fetchPartnerMessagesFromPg,
} from '@/lib/db/customer-care-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { PLATFORM_MESSAGING_PARTNER_ID } from '@/lib/messaging/platform-partner'

export const dynamic = 'force-dynamic'

/** Hội thoại chat nội bộ (đã đăng nhập): đồng bộ với admin inbox. */
export async function GET() {
  const auth = await getUserForAction('Unauthorized')
  if ('error' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = auth.user

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }

  try {
    const convPg = await fetchInternalConversationForUserPg(PLATFORM_MESSAGING_PARTNER_ID, user.id)
    if (!convPg) {
      return NextResponse.json({ conversation: null, messages: [] })
    }
    const messagesPg = await fetchPartnerMessagesFromPg(convPg.id)
    if (messagesPg === null) {
      return NextResponse.json({ error: 'Could not load messages.' }, { status: 500 })
    }
    return NextResponse.json({ conversation: convPg, messages: messagesPg })
  } catch (e) {
    console.warn('[internal thread GET]', e)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await getUserForAction('Unauthorized')
  if ('error' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = auth.user

  const body = (await request.json().catch(() => null)) as { text?: string } | null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 })
  }
  if (text.length > 8000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  }

  const display =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    user.email ||
    null

  const ensured = await ensureConversation({
    partnerId: PLATFORM_MESSAGING_PARTNER_ID,
    channel: 'internal',
    externalThreadId: user.id,
    customerName: display,
    linkedUserId: user.id,
    metadata: {},
  })
  if ('error' in ensured) {
    return NextResponse.json({ error: ensured.error ?? 'Failed to open thread' }, { status: 500 })
  }

  const ins = await insertMessage({
    conversationId: ensured.conversationId,
    direction: 'inbound',
    body: text,
  })
  if ('error' in ins) {
    return NextResponse.json({ error: ins.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
