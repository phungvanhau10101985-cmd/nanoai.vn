import type { User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'
import { postWidgetGuestMessage } from '@/lib/messaging/widget-guest-post'
import {
  createGuestSessionId,
  readGuestSessionIdFromRequest,
  writeGuestSessionCookie,
  writeGuestSessionHeader,
} from '@/lib/messaging/guest-auth-session'
import { readGuestAccountIdFromRequest, writeGuestAccountCookie } from '@/lib/messaging/guest-account-session'
import { mergeGuestSessionConversationToAccount } from '@/lib/messaging/guest-account-merge'

export const dynamic = 'force-dynamic'
/** LLM + typing delay có thể kéo dài khi job AI chạy ngay sau POST (không chờ cron). */
export const maxDuration = 120

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

function guestCustomerName(displayName: string, user: User | null) {
  const meta = (user?.user_metadata as Record<string, unknown> | undefined) ?? undefined
  const fullName = typeof meta?.full_name === 'string' ? meta.full_name : typeof meta?.name === 'string' ? meta.name : ''
  const email = user?.email?.trim() ?? ''
  const sessionLabel = !user ? 'Guest' : ''
  const label = (fullName || email || sessionLabel || 'Guest').trim().slice(0, 48)
  const shopShort = displayName.trim().slice(0, 36) || 'Shop'
  return `${label} · ${shopShort}`
}

async function resolveGuestIdentity(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.id) {
    return {
      user,
      externalThreadId: user.id,
      linkedUserId: user.id,
      guestAccountId: null as string | null,
      newSessionId: null as string | null,
    }
  }

  const accountId = readGuestAccountIdFromRequest(request)
  if (accountId) {
    return {
      user: null,
      externalThreadId: accountId,
      linkedUserId: null,
      guestAccountId: accountId,
      newSessionId: null as string | null,
    }
  }

  const existingSessionId = readGuestSessionIdFromRequest(request)
  if (existingSessionId) {
    return {
      user: null,
      externalThreadId: existingSessionId,
      linkedUserId: null,
      guestAccountId: null as string | null,
      newSessionId: null as string | null,
    }
  }

  const newSessionId = createGuestSessionId()
  return {
    user: null,
    externalThreadId: newSessionId,
    linkedUserId: null,
    guestAccountId: null as string | null,
    newSessionId,
  }
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

async function upsertGuestAccountForGoogleIdentity(
  db: ReturnType<typeof createServiceRoleClient>,
  partnerId: string,
  request: NextRequest,
  user: User | null
): Promise<string | null> {
  if (!user?.email) return null
  const email = normalizeEmail(user.email)
  const nowIso = new Date().toISOString()
  const accountByEmail = await db
    .from('messaging_guest_accounts')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('email_normalized', email)
    .maybeSingle()
  let accountId = accountByEmail.data?.id as string | undefined
  if (!accountId) {
    const created = await db
      .from('messaging_guest_accounts')
      .insert({
        partner_id: partnerId,
        email_raw: user.email,
        email_normalized: email,
        first_verified_at: nowIso,
        last_login_at: nowIso,
      })
      .select('id')
      .single()
    accountId = created.data?.id
  } else {
    await db.from('messaging_guest_accounts').update({ last_login_at: nowIso }).eq('id', accountId)
  }
  if (!accountId) return null

  await db
    .from('messaging_guest_identities')
    .upsert(
      {
            partner_id: partnerId,
        guest_account_id: accountId,
        provider: 'google',
        provider_subject: email,
      },
          { onConflict: 'partner_id,provider,provider_subject' }
    )
  const anonymousSessionId = readGuestSessionIdFromRequest(request)
  if (anonymousSessionId) {
    await mergeGuestSessionConversationToAccount(db, partnerId, anonymousSessionId, accountId)
  }
  return accountId
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const identity = await resolveGuestIdentity(request)

  const r = await resolvePartner(slug)
  if ('error' in r) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const { partnerId, db } = r
  let effectiveExternalThreadId = identity.externalThreadId
  let effectiveGuestAccountId = identity.guestAccountId

  if (identity.user?.id) {
    const accountId = await upsertGuestAccountForGoogleIdentity(db, partnerId, request, identity.user)
    if (accountId) {
      effectiveGuestAccountId = accountId
      effectiveExternalThreadId = accountId
    }
  }

  const { data: conv } = await db
    .from('customer_care_conversations')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('channel', 'widget')
    .eq('external_thread_id', effectiveExternalThreadId)
    .maybeSingle()
  if (!conv) {
    const res = NextResponse.json({
      messages: [],
      authMode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
    })
    if (identity.newSessionId) {
      writeGuestSessionCookie(res, request, identity.newSessionId)
      writeGuestSessionHeader(res, identity.newSessionId)
    }
    if (effectiveGuestAccountId) writeGuestAccountCookie(res, request, effectiveGuestAccountId)
    return res
  }
  const { data: messages, error } = await db
    .from('customer_care_messages')
    .select('id, direction, body, created_at, raw_payload')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const res = NextResponse.json({
    messages: messages ?? [],
    authMode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
  })
  if (identity.newSessionId) {
    writeGuestSessionCookie(res, request, identity.newSessionId)
    writeGuestSessionHeader(res, identity.newSessionId)
  }
  if (effectiveGuestAccountId) writeGuestAccountCookie(res, request, effectiveGuestAccountId)
  return res
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const identity = await resolveGuestIdentity(request)

  const body = (await request.json().catch(() => null)) as {
    text?: string
    imageStoragePath?: string
  } | null

  const r = await resolvePartner(slug)
  if ('error' in r) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const { partnerId, displayName, db } = r
  let effectiveExternalThreadId = identity.externalThreadId
  let effectiveGuestAccountId = identity.guestAccountId
  if (identity.user?.id) {
    const accountId = await upsertGuestAccountForGoogleIdentity(db, partnerId, request, identity.user)
    if (accountId) {
      effectiveGuestAccountId = accountId
      effectiveExternalThreadId = accountId
    }
  }

  const posted = await postWidgetGuestMessage(db, {
    partnerId,
    externalThreadId: effectiveExternalThreadId,
    linkedUserId: identity.linkedUserId,
    guestAccountId: effectiveGuestAccountId,
    customerName: guestCustomerName(displayName, identity.user),
    metadata: {
      source: 'nanoai_hosted_page',
      auth_mode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
    },
    text: body?.text,
    imageStoragePath: body?.imageStoragePath,
  })
  if ('error' in posted) {
    const status = posted.requireAuth ? 403 : posted.error === 'Invalid message.' ? 400 : 500
    const res = NextResponse.json(
      { error: posted.error, requireAuth: posted.requireAuth === true },
      { status }
    )
    if (identity.newSessionId) {
      writeGuestSessionCookie(res, request, identity.newSessionId)
      writeGuestSessionHeader(res, identity.newSessionId)
    }
    return res
  }
  const res = NextResponse.json({
    ok: true,
    shopTyping: posted.shopTyping,
    visionPickRequired: posted.visionPickRequired ?? false,
    authMode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
  })
  if (identity.newSessionId) {
    writeGuestSessionCookie(res, request, identity.newSessionId)
    writeGuestSessionHeader(res, identity.newSessionId)
  }
  if (effectiveGuestAccountId) writeGuestAccountCookie(res, request, effectiveGuestAccountId)
  return res
}
