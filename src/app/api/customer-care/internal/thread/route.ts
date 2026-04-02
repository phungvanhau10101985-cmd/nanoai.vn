import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLATFORM_MESSAGING_PARTNER_ID } from '@/lib/messaging/platform-partner'

export const dynamic = 'force-dynamic'

/** Hội thoại chat nội bộ (đã đăng nhập): đồng bộ với admin inbox. */
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: conv } = await supabase
    .from('customer_care_conversations')
    .select('*')
    .eq('partner_id', PLATFORM_MESSAGING_PARTNER_ID)
    .eq('channel', 'internal')
    .eq('external_thread_id', user.id)
    .maybeSingle()

  if (!conv) {
    return NextResponse.json({ conversation: null, messages: [] })
  }

  const { data: messages, error } = await supabase
    .from('customer_care_messages')
    .select('*')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ conversation: conv, messages: messages ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { text?: string } | null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 })
  }
  if (text.length > 8000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  }

  let { data: conv } = await supabase
    .from('customer_care_conversations')
    .select('id')
    .eq('partner_id', PLATFORM_MESSAGING_PARTNER_ID)
    .eq('channel', 'internal')
    .eq('external_thread_id', user.id)
    .maybeSingle()

  if (!conv) {
    const display =
      (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
      user.email ||
      null
    const { data: created, error: insConvErr } = await supabase
      .from('customer_care_conversations')
      .insert({
        partner_id: PLATFORM_MESSAGING_PARTNER_ID,
        channel: 'internal',
        external_thread_id: user.id,
        linked_user_id: user.id,
        customer_name: display,
        status: 'open',
        metadata: {},
      })
      .select('id')
      .single()

    if (insConvErr || !created) {
      return NextResponse.json({ error: insConvErr?.message ?? 'Failed to open thread' }, { status: 500 })
    }
    conv = created
  }

  const { error: msgErr } = await supabase.from('customer_care_messages').insert({
    conversation_id: conv.id,
    direction: 'inbound',
    body: text,
  })

  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
