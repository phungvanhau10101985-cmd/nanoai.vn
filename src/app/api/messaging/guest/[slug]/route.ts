import type { User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'
import { postWidgetGuestMessage } from '@/lib/messaging/widget-guest-post'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function resolvePartner(slug: string) {
  if (isReservedMessagingGuestSlug(slug)) {
    return { error: 'not_found' as const }
  }
  const db = createServiceRoleClient()
  const { data: partner, error } = await db
    .from('messaging_partners')
    .select('id, display_name, is_active')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !partner?.is_active) {
    return { error: 'not_found' as const }
  }
  return { partnerId: partner.id, displayName: partner.display_name, db }
}

function guestCustomerName(displayName: string, user: User) {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const fullName =
    typeof meta?.full_name === 'string'
      ? meta.full_name
      : typeof meta?.name === 'string'
        ? meta.name
        : ''
  const email = user.email?.trim() ?? ''
  const label = (fullName || email || 'Guest').trim().slice(0, 48)
  const shopShort = displayName.trim().slice(0, 36) || 'Shop'
  return `${label} · ${shopShort}`
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const r = await resolvePartner(slug)
  if ('error' in r) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const { partnerId, db } = r
  const { data: conv } = await db
    .from('customer_care_conversations')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('channel', 'widget')
    .eq('external_thread_id', user.id)
    .maybeSingle()
  if (!conv) {
    return NextResponse.json({ messages: [] })
  }
  const { data: messages, error } = await db
    .from('customer_care_messages')
    .select('id, direction, body, created_at, raw_payload')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ messages: messages ?? [] })
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    text?: string
    imageStoragePath?: string
  } | null

  const r = await resolvePartner(slug)
  if ('error' in r) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const { partnerId, displayName, db } = r

  const posted = await postWidgetGuestMessage(db, {
    partnerId,
    externalThreadId: user.id,
    linkedUserId: user.id,
    customerName: guestCustomerName(displayName, user),
    metadata: { source: 'nanoai_hosted_page' },
    text: body?.text,
    imageStoragePath: body?.imageStoragePath,
  })
  if ('error' in posted) {
    const status = posted.error === 'Invalid message.' ? 400 : 500
    return NextResponse.json({ error: posted.error }, { status })
  }
  return NextResponse.json({
    ok: true,
    shopTyping: posted.shopTyping,
    visionPickRequired: posted.visionPickRequired ?? false,
  })
}
