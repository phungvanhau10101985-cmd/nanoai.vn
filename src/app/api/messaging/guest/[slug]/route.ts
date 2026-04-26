import type { AppUser } from '@/lib/auth/app-user'
import {
  EMAIL_SESSION_COOKIE,
  EMAIL_SESSION_COOKIE_LEGACY,
} from '@/lib/auth/email-auth-config'
import { resolveCanonicalUserIdByEmail } from '@/lib/auth/resolve-canonical-email-user'
import {
  createEmailSessionTokenString,
  getEmailSessionCookieOptions,
} from '@/lib/auth/email-session-token'
import { NextRequest, NextResponse } from 'next/server'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { postWidgetGuestMessage } from '@/lib/messaging/widget-guest-post'
import { applyGuestIdentityToResponse, mirrorGuestSessionToClient } from '@/lib/messaging/guest-auth-session'
import {
  getHospitalityGuestThread,
  postHospitalityGuestThread,
} from '@/features/hospitality/guest-chat/hospitality-guest-thread'
import {
  resolveGuestIdentity,
  upsertGuestAccountForGoogleIdentity,
} from '@/lib/messaging/guest-widget-identity'
import {
  fetchConsultedProductKeysForConversationFromPg,
  fetchGuestWidgetConversationIdFromPg,
  fetchGuestWidgetMessagesWindowFromPg,
} from '@/lib/db/customer-care-pg'
import { fetchNanoaiChatProfileFromPg } from '@/lib/db/profiles-repo'
import { isPgConfigured } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'
/** LLM + typing delay có thể kéo dài khi job AI chạy ngay sau POST (không chờ cron). */
export const maxDuration = 120
const BATCH_IMAGE_MAX = 4
const BATCH_IMAGE_MESSAGE_GAP_MS = 500

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function resolvePartner(slug: string) {
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id, displayName: active.display_name, industryKey: active.industry_key }
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
  const r = await resolvePartner(slug)
  if ('error' in r) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (r.industryKey === 'hotel') {
    return getHospitalityGuestThread(request, slug)
  }

  const identity = await resolveGuestIdentity(request)
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

  const jwtUid = identity.user?.id?.trim()
  const sessionEmail = identity.user?.email?.trim()
  let profileUid: string | undefined = jwtUid
  let emailSessionRemapToken: string | null = null
  if (jwtUid && sessionEmail) {
    const canon = await resolveCanonicalUserIdByEmail(sessionEmail)
    if (canon) {
      profileUid = canon
      if (canon !== jwtUid) {
        emailSessionRemapToken = await createEmailSessionTokenString(canon, sessionEmail)
      }
    }
  }

  const attachEmailSessionRemap = (res: NextResponse) => {
    if (!emailSessionRemapToken) return
    const opts = getEmailSessionCookieOptions()
    res.cookies.set(EMAIL_SESSION_COOKIE, emailSessionRemapToken, opts)
    res.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, emailSessionRemapToken, opts)
  }

  const buildGuestProfilePayload = async () => {
    if (!profileUid) {
      return { guestProfile: null as { birthDate: string | null; gender: string | null } | null, needsProfile: false }
    }
    const prof = await fetchNanoaiChatProfileFromPg(profileUid)
    const birthDate = prof?.birthDate ?? null
    const gender = prof?.gender ?? null
    return {
      guestProfile: { birthDate, gender },
      needsProfile: !birthDate || !gender,
    }
  }

  try {
    const { searchParams } = new URL(request.url)
    const beforeId = (searchParams.get('before_id') || '').trim() || null
    const limitRaw = Number.parseInt(searchParams.get('limit') || '', 10)
    const limit = Number.isFinite(limitRaw) ? limitRaw : undefined
    const convIdPg = await fetchGuestWidgetConversationIdFromPg(partnerId, effectiveExternalThreadId)
    if (convIdPg === null) {
      const gp = await buildGuestProfilePayload()
      const res = NextResponse.json({
        messages: [],
        consultedProductKeys: [] as string[],
        authMode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
        ...gp,
      })
      applyGuestIdentityToResponse(res, request, {
        newSessionId: identity.newSessionId,
        user: identity.user ?? null,
        effectiveExternalThreadId,
        effectiveGuestAccountId,
      })
      attachEmailSessionRemap(res)
      return res
    }
    const messagesPg = await fetchGuestWidgetMessagesWindowFromPg(convIdPg, {
      beforeMessageId: beforeId,
      limit,
    })
    if (messagesPg !== null) {
      const consultedProductKeys =
        (await fetchConsultedProductKeysForConversationFromPg(convIdPg)) ?? []
      const gp = await buildGuestProfilePayload()
      const res = NextResponse.json({
        messages: messagesPg.rows,
        hasMoreOlder: messagesPg.hasMoreOlder,
        consultedProductKeys,
        authMode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
        ...gp,
      })
      applyGuestIdentityToResponse(res, request, {
        newSessionId: identity.newSessionId,
        user: identity.user ?? null,
        effectiveExternalThreadId,
        effectiveGuestAccountId,
      })
      attachEmailSessionRemap(res)
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

  const r = await resolvePartner(slug)
  if ('error' in r) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (r.industryKey === 'hotel') {
    return postHospitalityGuestThread(request, slug)
  }

  const identity = await resolveGuestIdentity(request)
  const body = (await request.json().catch(() => null)) as {
    text?: string
    imageStoragePath?: string
    imageStoragePaths?: string[]
    /** URL trang lúc gửi — lưu `customer_care_messages.landing_source_url` (http/https). */
    landingSourceUrl?: string
    /** Ngôn ngữ UI khách (vi | en | zh | ja | ko) — đồng bộ tin hệ thống đơn hàng. */
    uiLocale?: string
    pageContext?: {
      sku?: string
      imageUrl?: string
      imageUrl2?: string
      productUrl?: string
      /** UUID dòng kho — neo «Tư vấn» theo id, không embed lại ảnh. */
      inventoryId?: string
      source?: string
    }
    clientHints?: {
      autoOpening?: boolean
    }
  } | null
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

  const normalizedImagePaths = [
    ...(Array.isArray(body?.imageStoragePaths)
      ? body.imageStoragePaths
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter((v) => v.length > 0)
      : []),
    ...(typeof body?.imageStoragePath === 'string' && body.imageStoragePath.trim()
      ? [body.imageStoragePath.trim()]
      : []),
  ]
  const imageStoragePaths = [...new Set(normalizedImagePaths)].slice(0, BATCH_IMAGE_MAX)
  const hasUploadedImages = imageStoragePaths.length > 0

  const sharedPayload = {
    partnerId,
    externalThreadId: effectiveExternalThreadId,
    linkedUserId: identity.linkedUserId,
    customerName: guestCustomerName(displayName, identity.user),
    uiLocale: typeof body?.uiLocale === 'string' ? body.uiLocale : undefined,
    metadata: {
      source: 'hosted_chat_page',
      auth_mode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
      ...(body?.pageContext && typeof body.pageContext === 'object'
        ? {
            page_context: {
              ...(typeof body.pageContext.sku === 'string' ? { sku: body.pageContext.sku } : {}),
              ...(typeof body.pageContext.imageUrl === 'string' ? { image_url: body.pageContext.imageUrl } : {}),
              ...(typeof body.pageContext.imageUrl2 === 'string' ? { image_url_2: body.pageContext.imageUrl2 } : {}),
              ...(typeof body.pageContext.productUrl === 'string' ? { product_url: body.pageContext.productUrl } : {}),
              ...(typeof body.pageContext.inventoryId === 'string' ? { inventory_id: body.pageContext.inventoryId } : {}),
              ...(typeof body.pageContext.source === 'string' ? { source: body.pageContext.source } : {}),
            },
          }
        : {}),
    },
    text: body?.text,
    autoOpening: body?.clientHints?.autoOpening === true && !hasUploadedImages,
    landingSourceUrl: typeof body?.landingSourceUrl === 'string' ? body.landingSourceUrl : undefined,
    pageContext: body?.pageContext,
  }

  const postOne = async (imageStoragePath?: string, pageContextOverride?: NonNullable<typeof body>['pageContext']) =>
    postWidgetGuestMessage({
      ...sharedPayload,
      guestAccountId: effectiveGuestAccountId,
      imageStoragePath,
      pageContext: pageContextOverride,
    })

  let posted:
    | Awaited<ReturnType<typeof postWidgetGuestMessage>>
    | { ok: true; shopTyping?: { maxWaitMs: number }; visionPickRequired?: boolean; paymentVerificationHandled?: boolean }

  if (imageStoragePaths.length <= 1) {
    posted = await postOne(imageStoragePaths[0], body?.pageContext)
  } else {
    let maxWaitMs = 0
    let anyVisionPickRequired = false
    let anyPaymentVerificationHandled = false
    let batchError: Awaited<ReturnType<typeof postWidgetGuestMessage>> | null = null
    for (let i = 0; i < imageStoragePaths.length; i += 1) {
      const one = await postOne(imageStoragePaths[i], i === 0 ? body?.pageContext : undefined)
      if ('error' in one) {
        batchError = one
        break
      }
      if (one.shopTyping?.maxWaitMs && one.shopTyping.maxWaitMs > maxWaitMs) {
        maxWaitMs = one.shopTyping.maxWaitMs
      }
      anyVisionPickRequired = anyVisionPickRequired || one.visionPickRequired === true
      anyPaymentVerificationHandled =
        anyPaymentVerificationHandled || one.paymentVerificationHandled === true
      if (i < imageStoragePaths.length - 1) {
        await sleep(BATCH_IMAGE_MESSAGE_GAP_MS)
      }
    }
    posted = batchError ?? {
      ok: true,
      ...(maxWaitMs > 0 ? { shopTyping: { maxWaitMs } } : {}),
      visionPickRequired: anyVisionPickRequired || undefined,
      paymentVerificationHandled: anyPaymentVerificationHandled || undefined,
    }
  }

  if ('error' in posted) {
    const status = posted.requireAuth ? 403 : posted.error === 'Invalid message.' ? 400 : 500
    const res = NextResponse.json({ error: posted.error, requireAuth: posted.requireAuth === true }, { status })
    if (identity.newSessionId) {
      mirrorGuestSessionToClient(res, request, identity.newSessionId)
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
  applyGuestIdentityToResponse(res, request, {
    newSessionId: identity.newSessionId,
    user: identity.user ?? null,
    effectiveExternalThreadId,
    effectiveGuestAccountId,
  })
  return res
}
