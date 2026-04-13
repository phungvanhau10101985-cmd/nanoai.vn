import type { AppUser } from '@/lib/auth/app-user'
import { NextRequest, NextResponse } from 'next/server'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { postWidgetGuestMessage } from '@/lib/messaging/widget-guest-post'
import { writeGuestSessionCookie, writeGuestSessionHeader } from '@/lib/messaging/guest-auth-session'
import { writeGuestAccountCookie } from '@/lib/messaging/guest-account-session'
import {
  resolveGuestIdentity,
  upsertGuestAccountForGoogleIdentity,
} from '@/lib/messaging/guest-widget-identity'
import {
  fetchConsultedProductKeysForConversationFromPg,
  fetchGuestWidgetConversationIdFromPg,
  fetchGuestWidgetMessagesSubsetFromPg,
} from '@/lib/db/customer-care-pg'
import { isPgConfigured } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'
/** LLM + typing delay có thể kéo dài khi job AI chạy ngay sau POST (không chờ cron). */
export const maxDuration = 120

async function resolvePartner(slug: string) {
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id, displayName: active.display_name }
}

function guestCustomerName(displayName: string, user: AppUser | null) {
  const meta = (user?.user_metadata as Record<string, unknown> | undefined) ?? undefined
  const fullName = typeof meta?.full_name === 'string' ? meta.full_name : typeof meta?.name === 'string' ? meta.name : ''
  const email = user?.email?.trim() ?? ''
  const sessionLabel = !user ? 'Guest' : ''
  const label = (fullName || email || sessionLabel || 'Guest').trim().slice(0, 48)
  const shopShort = displayName.trim().slice(0, 36) || 'Shop'
  return `${label} · ${shopShort}`
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const identity = await resolveGuestIdentity(request)

  const r = await resolvePartner(slug)
  if ('error' in r) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const { partnerId } = r
  let effectiveExternalThreadId = identity.externalThreadId
  let effectiveGuestAccountId = identity.guestAccountId

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database unavailable.' }, { status: 503 })
  }

  if (identity.user?.id) {
    const accountId = await upsertGuestAccountForGoogleIdentity(partnerId, request, identity.user)
    if (accountId) {
      effectiveGuestAccountId = accountId
      effectiveExternalThreadId = accountId
    }
  }

  try {
    const convIdPg = await fetchGuestWidgetConversationIdFromPg(partnerId, effectiveExternalThreadId)
    if (convIdPg === null) {
      const res = NextResponse.json({
        messages: [],
        consultedProductKeys: [] as string[],
        authMode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
      })
      if (identity.newSessionId) {
        writeGuestSessionCookie(res, request, identity.newSessionId)
        writeGuestSessionHeader(res, identity.newSessionId)
      }
      if (effectiveGuestAccountId) writeGuestAccountCookie(res, request, effectiveGuestAccountId)
      return res
    }
    const messagesPg = await fetchGuestWidgetMessagesSubsetFromPg(convIdPg)
    if (messagesPg !== null) {
      const consultedProductKeys =
        (await fetchConsultedProductKeysForConversationFromPg(convIdPg)) ?? []
      const res = NextResponse.json({
        messages: messagesPg,
        consultedProductKeys,
        authMode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
      })
      if (identity.newSessionId) {
        writeGuestSessionCookie(res, request, identity.newSessionId)
        writeGuestSessionHeader(res, identity.newSessionId)
      }
      if (effectiveGuestAccountId) writeGuestAccountCookie(res, request, effectiveGuestAccountId)
      return res
    }
    return NextResponse.json({ error: 'Failed to load messages.' }, { status: 500 })
  } catch (e) {
    console.warn('[guest widget GET] PG load failed', e)
    return NextResponse.json({ error: 'Server database unavailable.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const identity = await resolveGuestIdentity(request)

  const body = (await request.json().catch(() => null)) as {
    text?: string
    imageStoragePath?: string
    pageContext?: {
      sku?: string
      imageUrl?: string
      productUrl?: string
      source?: string
    }
  } | null

  const r = await resolvePartner(slug)
  if ('error' in r) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const { partnerId, displayName } = r

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database unavailable.' }, { status: 503 })
  }

  let effectiveExternalThreadId = identity.externalThreadId
  let effectiveGuestAccountId = identity.guestAccountId
  if (identity.user?.id) {
    const accountId = await upsertGuestAccountForGoogleIdentity(partnerId, request, identity.user)
    if (accountId) {
      effectiveGuestAccountId = accountId
      effectiveExternalThreadId = accountId
    }
  }

  const posted = await postWidgetGuestMessage({
    partnerId,
    externalThreadId: effectiveExternalThreadId,
    linkedUserId: identity.linkedUserId,
    guestAccountId: effectiveGuestAccountId,
    customerName: guestCustomerName(displayName, identity.user),
    metadata: {
      source: 'hosted_chat_page',
      auth_mode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
      ...(body?.pageContext && typeof body.pageContext === 'object'
        ? {
            page_context: {
              ...(typeof body.pageContext.sku === 'string' ? { sku: body.pageContext.sku } : {}),
              ...(typeof body.pageContext.imageUrl === 'string' ? { image_url: body.pageContext.imageUrl } : {}),
              ...(typeof body.pageContext.productUrl === 'string' ? { product_url: body.pageContext.productUrl } : {}),
              ...(typeof body.pageContext.source === 'string' ? { source: body.pageContext.source } : {}),
            },
          }
        : {}),
    },
    text: body?.text,
    imageStoragePath: body?.imageStoragePath,
    pageContext: body?.pageContext,
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
    paymentVerificationHandled: posted.paymentVerificationHandled ?? false,
    authMode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
  })
  if (identity.newSessionId) {
    writeGuestSessionCookie(res, request, identity.newSessionId)
    writeGuestSessionHeader(res, identity.newSessionId)
  }
  if (effectiveGuestAccountId) writeGuestAccountCookie(res, request, effectiveGuestAccountId)
  return res
}
