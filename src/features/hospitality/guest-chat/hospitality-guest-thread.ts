import type { AppUser } from '@/lib/auth/app-user'
import { NextRequest, NextResponse } from 'next/server'
import { resolveHospitalityPartnerBySlug } from '@/lib/hospitality/hospitality-partner-resolver'
import { postHospitalityGuestMessage } from '@/features/hospitality/guest-chat/post-hospitality-guest-message'
import {
  applyHospitalityGuestIdentityToResponse,
  resolveHospitalityGuestIdentity,
  upsertHospitalityGuestAccountForGoogleIdentity,
} from '@/lib/hospitality/hospitality-guest-identity'
import {
  fetchHospitalityGuestConversationId,
  fetchHospitalityGuestMessagesSubset,
} from '@/lib/hospitality/hospitality-conversation-service'
import { isPgConfigured } from '@/lib/db/pool'

function guestCustomerName(displayName: string, user: AppUser | null) {
  const meta = (user?.user_metadata as Record<string, unknown> | undefined) ?? undefined
  const fullName = typeof meta?.full_name === 'string' ? meta.full_name : typeof meta?.name === 'string' ? meta.name : ''
  const email = user?.email?.trim() ?? ''
  const sessionLabel = !user ? 'Guest' : ''
  const label = (fullName || email || sessionLabel || 'Guest').trim().slice(0, 48)
  const shopShort = displayName.trim().slice(0, 36) || 'Hotel'
  return `${label} · ${shopShort}`
}

async function resolveHospitalityPartner(slug: string) {
  const active = await resolveHospitalityPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id, displayName: active.display_name }
}

export async function getHospitalityGuestThread(request: NextRequest, slug: string) {
  const identity = await resolveHospitalityGuestIdentity(request)
  const r = await resolveHospitalityPartner(slug)
  if ('error' in r) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const { partnerId } = r

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database unavailable.' }, { status: 503 })
  }

  let effectiveExternalThreadId = identity.externalThreadId
  let effectiveGuestAccountId = identity.guestAccountId
  if (identity.user?.id) {
    const accountId = await upsertHospitalityGuestAccountForGoogleIdentity(partnerId, request, identity.user)
    if (accountId) {
      effectiveGuestAccountId = accountId
      effectiveExternalThreadId = accountId
    }
  }

  try {
    const convIdPg = await fetchHospitalityGuestConversationId(partnerId, effectiveExternalThreadId)
    const messages = convIdPg ? ((await fetchHospitalityGuestMessagesSubset(convIdPg)) ?? []) : []
    const res = NextResponse.json({
      messages,
      authMode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
      needsProfile: false,
      guestProfile: null,
    })
    applyHospitalityGuestIdentityToResponse(res, request, {
      newSessionId: identity.newSessionId,
      user: identity.user ?? null,
      effectiveExternalThreadId,
      effectiveGuestAccountId,
    })
    return res
  } catch (e) {
    console.warn('[hospitality guest GET] load failed', e)
    return NextResponse.json({ error: 'Server database unavailable.' }, { status: 503 })
  }
}

export async function postHospitalityGuestThread(request: NextRequest, slug: string) {
  const identity = await resolveHospitalityGuestIdentity(request)
  const body = (await request.json().catch(() => null)) as {
    text?: string
    imageStoragePath?: string
    landingSourceUrl?: string
    uiLocale?: string
    pageContext?: {
      inventoryId?: string
      source?: string
      checkinAt?: string
      checkoutAt?: string
    }
    clientHints?: {
      autoOpening?: boolean
    }
  } | null

  const r = await resolveHospitalityPartner(slug)
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
    const accountId = await upsertHospitalityGuestAccountForGoogleIdentity(partnerId, request, identity.user)
    if (accountId) {
      effectiveGuestAccountId = accountId
      effectiveExternalThreadId = accountId
    }
  }

  const posted = await postHospitalityGuestMessage({
    partnerId,
    externalThreadId: effectiveExternalThreadId,
    linkedUserId: identity.linkedUserId,
    customerName: guestCustomerName(displayName, identity.user),
    uiLocale: typeof body?.uiLocale === 'string' ? body.uiLocale : undefined,
    metadata: {
      source: 'hosted_hospitality_chat_page',
      auth_mode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
      ...(body?.pageContext && typeof body.pageContext === 'object'
        ? {
            page_context: {
              ...(typeof body.pageContext.inventoryId === 'string'
                ? { room_type_id: body.pageContext.inventoryId }
                : {}),
              ...(typeof body.pageContext.source === 'string' ? { source: body.pageContext.source } : {}),
              ...(typeof body.pageContext.checkinAt === 'string' ? { checkin_at: body.pageContext.checkinAt } : {}),
              ...(typeof body.pageContext.checkoutAt === 'string' ? { checkout_at: body.pageContext.checkoutAt } : {}),
            },
          }
        : {}),
    },
    text: body?.text,
    imageStoragePath: body?.imageStoragePath,
    autoOpening: body?.clientHints?.autoOpening === true,
    landingSourceUrl: typeof body?.landingSourceUrl === 'string' ? body.landingSourceUrl : undefined,
    pageContext: body?.pageContext,
  })

  if ('error' in posted) {
    const res = NextResponse.json(
      { error: posted.error, requireAuth: posted.requireAuth === true },
      { status: posted.requireAuth ? 403 : posted.error === 'Invalid message.' ? 400 : 500 }
    )
    applyHospitalityGuestIdentityToResponse(res, request, {
      newSessionId: identity.newSessionId,
      user: identity.user ?? null,
      effectiveExternalThreadId,
      effectiveGuestAccountId,
    })
    return res
  }

  const res = NextResponse.json({
    ok: true,
    shopTyping: posted.shopTyping,
    authMode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
  })
  applyHospitalityGuestIdentityToResponse(res, request, {
    newSessionId: identity.newSessionId,
    user: identity.user ?? null,
    effectiveExternalThreadId,
    effectiveGuestAccountId,
  })
  return res
}
