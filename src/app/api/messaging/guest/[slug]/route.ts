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
import {
  postWidgetGuestMessage,
  type WidgetGuestImageBatchItemResult,
} from '@/lib/messaging/widget-guest-post'
import { insertMessage } from '@/lib/customer-care/conversation-service'
import { resolveGuestCustomerDisplayName } from '@/lib/messaging/guest-customer-display-name'
import { applyGuestIdentityToResponse } from '@/lib/messaging/guest-auth-session'
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
  touchGuestViewerLastSeenFromPg,
} from '@/lib/db/customer-care-pg'
import { fetchNanoaiChatProfileFromPg } from '@/lib/db/profiles-repo'
import { isPgConfigured } from '@/lib/db/pool'
import { normalizeWebLocale } from '@/lib/i18n/config'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { resolvePartnerCustomerLoyaltyStatusFromPg } from '@/lib/db/messaging-partner-loyalty-pg'

export const dynamic = 'force-dynamic'
/** LLM + typing delay có thể kéo dài khi job AI chạy ngay sau POST (không chờ cron). */
export const maxDuration = 120
const BATCH_IMAGE_MAX = 4
const BATCH_IMAGE_MESSAGE_GAP_MS = 500

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function batchCandidateToCard(
  c: WidgetGuestImageBatchItemResult['productPickCandidates'][number]
): PartnerAiProductCard | null {
  const name = c.name.trim()
  const image_url = c.image_url.trim()
  const product_url = c.product_url?.trim() ?? ''
  if (!name || !/^https?:\/\//i.test(image_url) || !/^https?:\/\//i.test(product_url)) return null
  return {
    name,
    image_url,
    product_url,
    ...(c.price_hint?.trim() ? { price_hint: c.price_hint.trim() } : {}),
    ...(c.sku?.trim() ? { sku: c.sku.trim().slice(0, 128) } : {}),
    inventory_id: c.inventoryId,
  }
}

function dedupeBatchCards(candidates: WidgetGuestImageBatchItemResult['productPickCandidates']): PartnerAiProductCard[] {
  const seen = new Set<string>()
  const cards: PartnerAiProductCard[] = []
  for (const c of candidates) {
    const key = c.inventoryId || c.sku || `${c.name}|${c.image_url}`
    if (seen.has(key)) continue
    seen.add(key)
    const card = batchCandidateToCard(c)
    if (card) cards.push(card)
    if (cards.length >= 12) break
  }
  return cards
}

function productLineForBatchCard(card: PartnerAiProductCard, index: number): string {
  const sku = card.sku ? ` - ${card.sku}` : ''
  const price = card.price_hint ? ` - ${card.price_hint}` : ''
  return `${index + 1}. ${card.name}${sku}${price}`
}

function buildImageBatchReplyBody(input: {
  uiLocale?: string | null
  totalImages: number
  matchedImageCount: number
  cards: PartnerAiProductCard[]
  usingNearMatches: boolean
}): string {
  const locale = normalizeWebLocale(input.uiLocale ?? null) ?? 'vi'
  const unmatched = Math.max(0, input.totalImages - input.matchedImageCount)
  const productLines = input.cards.slice(0, 4).map(productLineForBatchCard).join('\n')

  if (locale === 'en') {
    const intro = input.usingNearMatches
      ? `I received ${input.totalImages} images but could not confirm exact matches, so I’m sending the closest items I found.`
      : unmatched > 0
        ? `I received ${input.totalImages} images: ${input.matchedImageCount} matched items in the shop, while ${unmatched} did not have a clear match yet.`
        : `I received ${input.totalImages} images and matched ${input.cards.length} item(s) in the shop.`
    return [intro, productLines, 'Please tell me which items you want to compare or need size/color advice for.']
      .filter(Boolean)
      .join('\n\n')
  }
  if (locale === 'zh') {
    const intro = input.usingNearMatches
      ? `我收到了 ${input.totalImages} 张图片，但还不能确认完全匹配的商品，先发送最接近的款式供您参考。`
      : unmatched > 0
        ? `我收到了 ${input.totalImages} 张图片：其中 ${input.matchedImageCount} 张匹配到店内商品，另外 ${unmatched} 张暂未找到明确匹配。`
        : `我收到了 ${input.totalImages} 张图片，并匹配到店内 ${input.cards.length} 个商品。`
    return [intro, productLines, '您想比较哪些款式，或需要尺码/颜色建议，可以直接告诉我。'].filter(Boolean).join('\n\n')
  }
  if (locale === 'ja') {
    const intro = input.usingNearMatches
      ? `${input.totalImages} 枚の画像を受け取りましたが、完全一致は確認できないため、近い商品をお送りします。`
      : unmatched > 0
        ? `${input.totalImages} 枚の画像を受け取りました。${input.matchedImageCount} 枚は店舗の商品に一致し、${unmatched} 枚は明確な一致がまだありません。`
        : `${input.totalImages} 枚の画像から、店舗内の ${input.cards.length} 商品に一致しました。`
    return [intro, productLines, '比較したい商品や、サイズ・色の相談があればそのまま送ってください。'].filter(Boolean).join('\n\n')
  }
  if (locale === 'ko') {
    const intro = input.usingNearMatches
      ? `이미지 ${input.totalImages}장을 받았지만 정확한 일치는 확인되지 않아 가장 가까운 상품을 보내드려요.`
      : unmatched > 0
        ? `이미지 ${input.totalImages}장 중 ${input.matchedImageCount}장은 매장 상품과 매칭됐고, ${unmatched}장은 아직 뚜렷한 매칭이 없어요.`
        : `이미지 ${input.totalImages}장에서 매장 상품 ${input.cards.length}개를 찾았어요.`
    return [intro, productLines, '비교하고 싶은 상품이나 사이즈/색상 상담이 필요하면 바로 말씀해 주세요.'].filter(Boolean).join('\n\n')
  }

  const intro = input.usingNearMatches
    ? `Em đã nhận ${input.totalImages} ảnh, nhưng chưa thấy mẫu khớp chắc trong kho. Em gửi các mẫu gần giống nhất để anh/chị tham khảo ạ.`
    : unmatched > 0
      ? `Em đã nhận ${input.totalImages} ảnh: ${input.matchedImageCount} ảnh khớp được mẫu trong kho, ${unmatched} ảnh còn lại chưa thấy mẫu khớp rõ.`
      : input.cards.length === 1
        ? `Em đã nhận ${input.totalImages} ảnh và các ảnh đang khớp cùng một mẫu trong kho.`
        : `Em đã nhận ${input.totalImages} ảnh và khớp được ${input.cards.length} mẫu trong kho.`
  return [
    intro,
    productLines,
    'Anh/chị muốn em so sánh mẫu nào hoặc tư vấn size/màu cho mẫu nào thì nhắn em ngay ạ.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function resolvePartner(slug: string) {
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id, displayName: active.display_name, industryKey: active.industry_key }
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

  const buildLoyaltyPayload = async () => {
    const status = await resolvePartnerCustomerLoyaltyStatusFromPg({
      partnerId,
      identity: {
        emailNormalized: identity.user?.email ?? null,
        linkedUserId: identity.linkedUserId ?? null,
        guestAccountId: effectiveGuestAccountId ?? null,
      },
    })
    return {
      loyaltyStatus: {
        enabled: status.enabled,
        tierCode: status.tier?.tier_code ?? '',
        tierName: status.tier?.tier_name ?? '',
        discountPercent: status.tier?.discount_percent ?? 0,
        totalSpent: status.totalSpent,
        nextTierCode: status.nextTier?.tier_code ?? '',
        amountToNextTier: status.amountToNextTier,
      },
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
      const loyalty = await buildLoyaltyPayload()
      const res = NextResponse.json({
        messages: [],
        consultedProductKeys: [] as string[],
        authMode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
        ...gp,
        ...loyalty,
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
      if (!beforeId) {
        void touchGuestViewerLastSeenFromPg(convIdPg)
      }
      const consultedProductKeys =
        (await fetchConsultedProductKeysForConversationFromPg(convIdPg)) ?? []
      const gp = await buildGuestProfilePayload()
      const loyalty = await buildLoyaltyPayload()
      const res = NextResponse.json({
        messages: messagesPg.rows,
        hasMoreOlder: messagesPg.hasMoreOlder,
        consultedProductKeys,
        authMode: effectiveGuestAccountId || identity.linkedUserId ? 'account' : 'anonymous',
        ...gp,
        ...loyalty,
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
    customerName: await resolveGuestCustomerDisplayName({
      partnerId,
      shopDisplayName: displayName,
      user: identity.user,
      guestAccountId: effectiveGuestAccountId,
      linkedUserId: identity.linkedUserId,
      externalThreadId: effectiveExternalThreadId,
    }),
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

  const postOne = async (
    imageStoragePath?: string,
    pageContextOverride?: NonNullable<typeof body>['pageContext'],
    deferImageBatchReply = false
  ) =>
    postWidgetGuestMessage({
      ...sharedPayload,
      guestAccountId: effectiveGuestAccountId,
      imageStoragePath,
      pageContext: pageContextOverride,
      deferImageBatchReply,
    })

  let posted:
    | Awaited<ReturnType<typeof postWidgetGuestMessage>>
    | { ok: true; shopTyping?: { maxWaitMs: number }; visionPickRequired?: boolean; paymentVerificationHandled?: boolean }

  if (imageStoragePaths.length <= 1) {
    posted = await postOne(imageStoragePaths[0], body?.pageContext)
  } else {
    let conversationId: string | null = null
    const batchItems: WidgetGuestImageBatchItemResult[] = []
    let anyPaymentVerificationHandled = false
    let batchError: Awaited<ReturnType<typeof postWidgetGuestMessage>> | null = null
    for (let i = 0; i < imageStoragePaths.length; i += 1) {
      const one = await postOne(imageStoragePaths[i], i === 0 ? body?.pageContext : undefined, true)
      if ('error' in one) {
        batchError = one
        break
      }
      if (one.conversationId) conversationId = one.conversationId
      if (one.imageBatchItem) batchItems.push(one.imageBatchItem)
      anyPaymentVerificationHandled =
        anyPaymentVerificationHandled || one.paymentVerificationHandled === true
      if (i < imageStoragePaths.length - 1) {
        await sleep(BATCH_IMAGE_MESSAGE_GAP_MS)
      }
    }
    if (!batchError && conversationId && batchItems.length > 0) {
      const productBatchItems = batchItems.filter((item) => !item.paymentVerificationHandled)
      const matchedCandidates = productBatchItems
        .map((item) => item.autoSelectedTopCandidate)
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
      const usingNearMatches = matchedCandidates.length === 0
      const candidatesForCards = usingNearMatches
        ? productBatchItems.flatMap((item) => item.productPickCandidates.slice(0, 3))
        : matchedCandidates
      const cards = dedupeBatchCards(candidatesForCards)
      const hasProductSearchResult = cards.length > 0
      if (productBatchItems.length > 0 && (hasProductSearchResult || matchedCandidates.length < productBatchItems.length)) {
        const replyBody = buildImageBatchReplyBody({
          uiLocale: typeof body?.uiLocale === 'string' ? body.uiLocale : undefined,
          totalImages: productBatchItems.length,
          matchedImageCount: matchedCandidates.length,
          cards,
          usingNearMatches,
        })
        await insertMessage({
          conversationId,
          direction: 'outbound',
          body: replyBody,
          rawPayload: {
            source: 'guest_image_batch_summary',
            ai_product_cards: cards,
            image_batch: {
              total_images: productBatchItems.length,
              matched_image_count: matchedCandidates.length,
              unmatched_image_count: Math.max(0, productBatchItems.length - matchedCandidates.length),
              mode: usingNearMatches ? 'near_matches' : 'matched_products',
            },
          },
        })
      }
    }
    posted = batchError ?? {
      ok: true,
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
