import type { Database, Json } from '@/types/database.types'
import type { GuestProfileGender } from '@/lib/db/messaging-guest-pg'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import {
  fetchConversationUiLocaleFromPg,
  fetchCustomerCareConversationByIdPg,
  fetchCustomerCareTranscriptLinesFromPg,
  fetchLastOutboundCustomerCareMessageBodyPg,
  fetchRecentInboundCustomerCareMessageBodiesPg,
  fetchTwoCareMessagesImmediatelyBeforePg,
  mergeCustomerCareMessageRawPayloadPatchPg,
} from '@/lib/db/customer-care-pg'
import { fetchGuestGenderForPartnerConsultCachePg } from '@/lib/db/partner-product-consult-cache-pg'
import { fetchMessagingPartnerAiSettingsFullFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'
import { fetchMessagingPartnerByIdFromPg } from '@/lib/db/messaging-partners-pg'
import {
  cancelPendingAiJobsForConversationPg,
  insertPartnerAiJobPg,
} from '@/lib/db/messaging-partner-ai-jobs-pg'
import { isPgConfigured } from '@/lib/db/pool'
import type { CustomerCareChannel } from '@/lib/customer-care/types'
import {
  inboundBodyHasCustomerUploadedImage,
  inboundTextHasVisionSelectionHint,
  previousInboundHasCustomerUploadedImage,
} from '@/lib/messaging/guest-chat-image'
import {
  inboundTextLooksLikeAskSkuOfThisPhotoItem,
  inboundTextLooksLikeConsultThisPhotoItem,
} from '@/lib/messaging/partner-ai-photo-item-consult'
import { deliverAutomatedPartnerMessage } from '@/lib/messaging/partner-ai-deliver'
import { runMessagingPartnerAiJobBatch } from '@/lib/messaging/partner-ai-run-jobs'
import { normalizeWebLocale } from '@/lib/i18n/config'
import {
  inboundTextLooksLikeOrderStatusAsk,
  inboundTextLooksLikePolicyRefundOrCancelAsk,
  inboundTextLooksLikePurchasePickListIntent,
} from '@/lib/messaging/partner-ai-purchase-intent'
import { inboundTextLooksLikeFollowUpConsultHeuristic } from '@/lib/messaging/partner-inventory-ai-search'
import {
  findLatestBoundOrderSnapshot,
  firstBoundOrderSku,
  formatBoundOrderDepositConfirmReply,
  formatBoundOrderRecapReply,
  inboundTextFollowsBoundOrder,
  inboundTextLooksLikeBoundOrderVariantFollowUp,
  inboundTextLooksLikeDepositConfirmAsk,
  inboundTextSwitchesOffBoundOrder,
  snapshotFromShippingHit,
} from '@/lib/messaging/partner-ai-bound-order'
import {
  buildPurchasePickListCardsFromConversation,
  purchasePickListMessageBody,
} from '@/lib/messaging/partner-ai-purchase-pick-list'
import { classifyWidgetInboundIntent } from '@/lib/messaging/partner-ai-widget-intent-classifier'
import {
  createPartnerAiRouteDecision,
  partnerAiRouteDecisionToPayload,
  type PartnerAiRouteDecision,
} from '@/lib/messaging/partner-ai-intent-router'
import { enforceConfiguredGenderAddressing } from '@/lib/messaging/partner-ai-gender-addressing'
import {
  chatOrderFollowupGuideMessageNeutral,
  inboundTextLooksLikeCannotOrderOnWebIntent,
  precedingPairHasFashionProductAdvice,
  resolveChatOrderFollowupCards,
} from '@/lib/messaging/partner-ai-chat-order-followup'
import {
  extractShippingLookupQuery,
  extractShippingLookupQueryFromThread,
  formatShippingLookupCustomerReply,
  formatShippingLookupMissReply,
  formatShippingLookupNeedIdReply,
  lookupPartnerShippingFromPg,
} from '@/lib/messaging/partner-shipping-lookup'

type SettingsRow = Database['public']['Tables']['messaging_partner_ai_settings']['Row']

/** Bỏ dòng gợi ý hệ thống / tiền tố 📷 — dùng cho phân loại ý định (khớp tin khách thuần). */
export function stripInboundBodyForIntentClassify(body: string): string {
  const lines = body.split('\n').map((l) => l.trimEnd())
  const kept: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (new RegExp('^\\[Customer product (?:SKU|URL|inventory id|image):', 'i').test(t)) continue
    kept.push(line)
  }
  return kept.join('\n').replace(/^📷\s*/u, '').trim()
}

async function mergePartnerAiWidgetIntentFromClassifier(input: {
  partnerId: string
  conversationId: string
  messageId: string
  inboundBody: string
  intentClassifyText?: string | null
}): Promise<PartnerAiRouteDecision | null> {
  if (process.env.PARTNER_AI_WIDGET_INTENT_CLASSIFIER === '0') return null
  const raw = (input.intentClassifyText ?? stripInboundBodyForIntentClassify(input.inboundBody)).trim()
  if (raw.length < 1) return null
  try {
    const lastShop = await fetchLastOutboundCustomerCareMessageBodyPg(input.conversationId)
    const decision = await classifyWidgetInboundIntent({
      partnerId: input.partnerId,
      customerText: raw,
      lastShopMessage: lastShop,
    })
    if (!decision) return null
    await mergeCustomerCareMessageRawPayloadPatchPg(input.messageId, partnerAiRouteDecisionToPayload(decision))
    return decision
  } catch (e) {
    console.warn('[partner-ai-inbound] mergePartnerAiWidgetIntentFromClassifier', e)
    return null
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function typingDelayMs(settings: SettingsRow): number {
  const a = Math.min(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
  const b = Math.max(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
  return a + Math.floor(Math.random() * Math.max(1, b - a + 1))
}

function burstMergeDelaySec(channel: CustomerCareChannel): number {
  // Chỉ gộp burst cho widget: khách có thể gửi nhiều tin liên tục.
  if (channel !== 'widget') return 0
  const n = Number.parseInt(process.env.MESSAGING_PARTNER_AI_BURST_MERGE_SECONDS || '2', 10)
  if (!Number.isFinite(n)) return 2
  return Math.max(0, Math.min(10, n))
}

/** Hủy job AI đang chờ hoặc đang xử lý (tránh tin cũ «ăn» job mới). */
export async function cancelPendingAiJobsForConversation(conversationId: string) {
  try {
    if (!isPgConfigured()) return
    await cancelPendingAiJobsForConversationPg(conversationId)
  } catch (e) {
    console.error('[partner-ai] cancel jobs', e)
  }
}

async function runInstantPurchasePickList(ctx: {
  partnerId: string
  conversationId: string
  settings: SettingsRow
  body: string
  cards: PartnerAiProductCard[]
}) {
  let conv: Database['public']['Tables']['customer_care_conversations']['Row'] | null = null
  try {
    conv = await fetchCustomerCareConversationByIdPg(ctx.conversationId)
  } catch (e) {
    console.warn('[partner-ai] runInstantPurchasePickList PG conv failed', e)
  }
  if (!conv) return
  await sleep(typingDelayMs(ctx.settings))
  const rawPayload = {
    source: 'ai_purchase_pick_list',
    ai_product_cards: ctx.cards,
  } as unknown as Json
  const err = await deliverAutomatedPartnerMessage({
    conversation: conv,
    settings: ctx.settings,
    body: ctx.body,
    rawPayload,
  })
  if (err.error) console.error('[partner-ai] instant purchase pick list deliver', err.error)
}

async function runInstantChatOrderFollowup(ctx: {
  partnerId: string
  conversationId: string
  settings: SettingsRow
  cards: PartnerAiProductCard[]
  uiLocale: string | null | undefined
}) {
  let conv: Database['public']['Tables']['customer_care_conversations']['Row'] | null = null
  try {
    conv = await fetchCustomerCareConversationByIdPg(ctx.conversationId)
  } catch (e) {
    console.warn('[partner-ai] runInstantChatOrderFollowup PG conv failed', e)
  }
  if (!conv) return
  await sleep(typingDelayMs(ctx.settings))
  const neutral = chatOrderFollowupGuideMessageNeutral(normalizeWebLocale(ctx.uiLocale ?? null))
  let gender: GuestProfileGender | null = null
  try {
    gender = await fetchGuestGenderForPartnerConsultCachePg(conv.linked_user_id)
  } catch (e) {
    console.warn('[partner-ai] runInstantChatOrderFollowup gender', e)
  }
  const body = enforceConfiguredGenderAddressing(neutral, gender ?? null)
  const rawPayload = {
    source: 'ai_chat_order_guidance',
    ai_product_cards: ctx.cards,
  } as unknown as Json
  const err = await deliverAutomatedPartnerMessage({
    conversation: conv,
    settings: ctx.settings,
    body,
    rawPayload,
  })
  if (err.error) console.error('[partner-ai] instant chat order follow-up deliver', err.error)
}

async function runInstantShippingLookupReply(ctx: {
  conversationId: string
  settings: SettingsRow
  body: string
  boundOrder?: Record<string, unknown> | null
}) {
  let conv: Database['public']['Tables']['customer_care_conversations']['Row'] | null = null
  try {
    conv = await fetchCustomerCareConversationByIdPg(ctx.conversationId)
  } catch (e) {
    console.warn('[partner-ai] runInstantShippingLookupReply PG conv failed', e)
  }
  if (!conv) return
  await sleep(typingDelayMs(ctx.settings))
  const err = await deliverAutomatedPartnerMessage({
    conversation: conv,
    settings: ctx.settings,
    body: ctx.body,
    rawPayload: {
      source: 'guest_shipping_lookup_reply',
      ...(ctx.boundOrder ? { bound_order: ctx.boundOrder } : {}),
    } as unknown as Json,
  })
  if (err.error) console.error('[partner-ai] instant shipping lookup deliver', err.error)
}

/** Gợi ý UI phía khách: hiện “đang trả lời” trong khoảng maxWaitMs (poll nhanh hơn). */
export type PartnerInboundShopTypingHint = { show: false } | { show: true; maxWaitMs: number }

/**
 * Sau mỗi tin inbound từ khách (FB/Zalo/widget/hosted): nhánh tức thì (mua / hướng dẫn trong chat) hoặc lên lịch job AI.
 * Luôn await đến khi job đã insert (hoặc bỏ qua) để serverless không cắt giữa chừng.
 * Chỉ Postgres — cần `DATABASE_URL` để lên lịch job.
 */
export async function handlePartnerInboundForAi(input: {
  partnerId: string
  conversationId: string
  messageId: string
  inboundBody: string
  channel: CustomerCareChannel
  capReplyDelaySeconds?: number
  scheduleAiAfterSeconds?: number
  skipEagerBatchRun?: boolean
  /** Widget: locale vừa merge (vi/en/…) — chọn văn bản nhánh tức thì (mua trong chat, v.v.). */
  widgetUiLocale?: string | null
  /** Tin thuần để phân loại ý định (khác `inboundBody` khi có dòng [Customer product …]). */
  intentClassifyText?: string | null
}): Promise<PartnerInboundShopTypingHint> {
  if (input.channel === 'internal') return { show: false }

  try {
    const partnerGate = await fetchMessagingPartnerByIdFromPg(input.partnerId)
    if (partnerGate?.industry_key === 'hotel') {
      return { show: false }
    }
    const settings = await fetchMessagingPartnerAiSettingsFullFromPg(input.partnerId)

    if (!settings?.enabled) return { show: false }

    let routeDecision = await mergePartnerAiWidgetIntentFromClassifier({
      partnerId: input.partnerId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      inboundBody: input.inboundBody,
      intentClassifyText: input.intentClassifyText,
    })

    const skipFaq = inboundTextHasVisionSelectionHint(input.inboundBody)
    let faqLocale = normalizeWebLocale(input.widgetUiLocale ?? null)
    if (input.channel === 'widget' && faqLocale === null && isPgConfigured()) {
      try {
        const raw = await fetchConversationUiLocaleFromPg(input.conversationId)
        faqLocale = normalizeWebLocale(raw ?? null)
      } catch {
        faqLocale = null
      }
    }

    /** Shop thời trang: «không đặt được trên web» ngay sau tư vấn SP — hướng dẫn Mua trong chat + thẻ (ưu tiên trước FAQ). */
    if (
      partnerGate?.industry_key === 'fashion' &&
      !skipFaq &&
      isPgConfigured()
    ) {
      const probeForCantOrder = stripInboundBodyForIntentClassify(
        typeof input.intentClassifyText === 'string' && input.intentClassifyText.trim()
          ? input.intentClassifyText
          : input.inboundBody
      )
      if (probeForCantOrder.trim().length > 0 && inboundTextLooksLikeCannotOrderOnWebIntent(probeForCantOrder)) {
        try {
          const twoBefore = await fetchTwoCareMessagesImmediatelyBeforePg(
            input.conversationId,
            input.messageId
          )
          if (twoBefore && precedingPairHasFashionProductAdvice(twoBefore)) {
            const cards = await resolveChatOrderFollowupCards(input.partnerId, input.conversationId, twoBefore)
            if (cards.length > 0) {
              await cancelPendingAiJobsForConversation(input.conversationId)
              void runInstantChatOrderFollowup({
                partnerId: input.partnerId,
                conversationId: input.conversationId,
                settings,
                cards,
                uiLocale: faqLocale ? String(faqLocale) : input.widgetUiLocale ?? null,
              })
              const typingHi = Math.max(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
              return { show: true, maxWaitMs: typingHi + 10_000 }
            }
          }
        } catch (e) {
          console.warn('[partner-ai-inbound] fashion chat order follow-up', e)
        }
      }
    }

    const skipPurchasePickBranch = skipFaq
    let pickUiLocale = normalizeWebLocale(input.widgetUiLocale ?? null)
    if (input.channel === 'widget' && pickUiLocale === null && isPgConfigured()) {
      try {
        const raw = await fetchConversationUiLocaleFromPg(input.conversationId)
        pickUiLocale = normalizeWebLocale(raw ?? null)
      } catch {
        pickUiLocale = null
      }
    }
    /** Ảnh khách + ý mua: chỉ carousel vector theo ảnh (`widget-guest-post`), không gộp list «đã bấm Tư vấn». */
    const skipPurchasePickForCustomerImage =
      input.channel === 'widget' && inboundBodyHasCustomerUploadedImage(input.inboundBody)
    const probeForLookup = stripInboundBodyForIntentClassify(
      typeof input.intentClassifyText === 'string' && input.intentClassifyText.trim()
        ? input.intentClassifyText
        : input.inboundBody
    )
    let boundOrder = null as ReturnType<typeof findLatestBoundOrderSnapshot>
    let transcriptLines: Awaited<ReturnType<typeof fetchCustomerCareTranscriptLinesFromPg>> = null
    if (isPgConfigured()) {
      try {
        transcriptLines = await fetchCustomerCareTranscriptLinesFromPg(input.conversationId, 16)
        boundOrder = findLatestBoundOrderSnapshot(transcriptLines ?? [])
      } catch (e) {
        console.warn('[partner-ai-inbound] bound order transcript', e)
      }
    }
    const photoConsultAfterGuestImage =
      previousInboundHasCustomerUploadedImage(transcriptLines ?? []) &&
      (inboundTextLooksLikeConsultThisPhotoItem(probeForLookup) ||
        inboundTextLooksLikeAskSkuOfThisPhotoItem(probeForLookup))
    const switchOffBound = Boolean(
      boundOrder &&
        (inboundTextSwitchesOffBoundOrder(probeForLookup, boundOrder) ||
          inboundBodyHasCustomerUploadedImage(input.inboundBody) ||
          photoConsultAfterGuestImage)
    )
    const activeBound = boundOrder && !switchOffBound ? boundOrder : null
    const depositAsk = inboundTextLooksLikeDepositConfirmAsk(probeForLookup)
    const variantAsk = Boolean(activeBound && inboundTextLooksLikeBoundOrderVariantFollowUp(probeForLookup))
    const followsBound = Boolean(activeBound && inboundTextFollowsBoundOrder(probeForLookup, activeBound))
    const orderStatusAsk = inboundTextLooksLikeOrderStatusAsk(probeForLookup)
    /** Hỏi hoàn/hủy: AI `policy_or_order_support` — không cắt sang tra cứu / hỏi mã DH. */
    const policyRefundWithoutTrack =
      inboundTextLooksLikePolicyRefundOrCancelAsk(probeForLookup) && !orderStatusAsk
    const boundProductFollowUp =
      Boolean(activeBound) &&
      !policyRefundWithoutTrack &&
      inboundTextLooksLikeFollowUpConsultHeuristic(probeForLookup) &&
      !depositAsk &&
      !variantAsk &&
      !orderStatusAsk

    if (orderStatusAsk && routeDecision?.intent !== 'policy_or_order_support') {
      routeDecision = createPartnerAiRouteDecision('policy_or_order_support', {
        source: 'hard_rule',
        reason: 'order_status_lookup',
        confidence: 1,
      })
      try {
        await mergeCustomerCareMessageRawPayloadPatchPg(
          input.messageId,
          partnerAiRouteDecisionToPayload(routeDecision)
        )
      } catch (e) {
        console.warn('[partner-ai-inbound] order-status hard-rule payload', e)
      }
    }

    if (activeBound && boundProductFollowUp) {
      const sku = firstBoundOrderSku(activeBound)
      try {
        await mergeCustomerCareMessageRawPayloadPatchPg(input.messageId, {
          bound_order: activeBound,
          ...(sku
            ? { page_context: { sku, source: 'product_card_consult' } }
            : {}),
        })
      } catch (e) {
        console.warn('[partner-ai-inbound] bound order product follow-up payload', e)
      }
    }

    const skipPurchasePickForAfterSales =
      routeDecision?.intent === 'policy_or_order_support' ||
      orderStatusAsk ||
      followsBound ||
      variantAsk ||
      depositAsk ||
      Boolean(activeBound && boundProductFollowUp)
    const allowPhoneLookup =
      !activeBound && !policyRefundWithoutTrack && (orderStatusAsk || followsBound || depositAsk)
    let shippingQuery = extractShippingLookupQuery(probeForLookup, {
      allowPhone: allowPhoneLookup,
    })
    if (
      activeBound &&
      !boundProductFollowUp &&
      !policyRefundWithoutTrack &&
      (followsBound || orderStatusAsk || depositAsk || variantAsk)
    ) {
      shippingQuery = { type: 'order_code', value: activeBound.order_code }
    }
    if (!shippingQuery && allowPhoneLookup && isPgConfigured()) {
      try {
        const recentInbound = await fetchRecentInboundCustomerCareMessageBodiesPg(
          input.conversationId,
          8
        )
        shippingQuery = extractShippingLookupQueryFromThread(recentInbound, {
          allowPhone: true,
        })
      } catch (e) {
        console.warn('[partner-ai-inbound] shipping lookup thread phone', e)
      }
    }
    if (
      !boundProductFollowUp &&
      !policyRefundWithoutTrack &&
      shippingQuery &&
      (orderStatusAsk || depositAsk || variantAsk || followsBound) &&
      (allowPhoneLookup || shippingQuery.type !== 'phone')
    ) {
      try {
        const live = await lookupPartnerShippingFromPg(input.partnerId, shippingQuery)
        if (live) {
          await cancelPendingAiJobsForConversation(input.conversationId)
          const snap = live.ok
            ? snapshotFromShippingHit(live.hit, activeBound?.source ?? 'shipping_lookup')
            : null
          if (snap) {
            try {
              await mergeCustomerCareMessageRawPayloadPatchPg(input.messageId, { bound_order: snap })
            } catch (e) {
              console.warn('[partner-ai-inbound] bind order after lookup', e)
            }
          }
          let body: string
          if (!live.ok) {
            body = formatShippingLookupMissReply(shippingQuery, live, pickUiLocale)
          } else if (
            depositAsk &&
            (activeBound?.source === 'bank_transfer_receipt' || snap?.source === 'bank_transfer_receipt')
          ) {
            body = formatBoundOrderDepositConfirmReply(live.hit, { uiLocale: pickUiLocale })
          } else if (variantAsk) {
            body = formatBoundOrderRecapReply(live.hit, { uiLocale: pickUiLocale })
          } else {
            body = formatShippingLookupCustomerReply(live.hit, pickUiLocale)
          }
          void runInstantShippingLookupReply({
            conversationId: input.conversationId,
            settings,
            body,
            boundOrder: snap,
          })
          const typingHi = Math.max(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
          return { show: true, maxWaitMs: typingHi + 10_000 }
        }
      } catch (e) {
        console.warn('[partner-ai-inbound] shipping lookup', e)
      }
    }
    if (orderStatusAsk && !shippingQuery && !activeBound) {
      await cancelPendingAiJobsForConversation(input.conversationId)
      void runInstantShippingLookupReply({
        conversationId: input.conversationId,
        settings,
        body: formatShippingLookupNeedIdReply(pickUiLocale),
      })
      const typingHi = Math.max(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
      return { show: true, maxWaitMs: typingHi + 10_000 }
    }
    if (
      !skipPurchasePickBranch &&
      !skipPurchasePickForCustomerImage &&
      !skipPurchasePickForAfterSales &&
      inboundTextLooksLikePurchasePickListIntent(input.inboundBody)
    ) {
      const cards = await buildPurchasePickListCardsFromConversation(input.partnerId, input.conversationId)
      if (cards.length > 0) {
        await cancelPendingAiJobsForConversation(input.conversationId)
        void runInstantPurchasePickList({
          partnerId: input.partnerId,
          conversationId: input.conversationId,
          settings,
          body: purchasePickListMessageBody(pickUiLocale),
          cards,
        })
        const typingHi = Math.max(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
        return { show: true, maxWaitMs: typingHi + 10_000 }
      }
    }

    // Gộp burst: nếu khách nhắn dày trong thời gian ngắn, chỉ giữ job mới nhất.
    const mergeDelay = burstMergeDelaySec(input.channel)
    if (mergeDelay > 0) {
      await cancelPendingAiJobsForConversation(input.conversationId)
    }
    const configuredDelay =
      input.channel === 'widget'
        ? 0
        : Math.max(5, Math.min(30, settings.reply_delay_seconds ?? 20))
    const exactSchedule =
      input.scheduleAiAfterSeconds != null && Number.isFinite(input.scheduleAiAfterSeconds)
    let delaySec: number
    let visionFastFallback: boolean
    if (exactSchedule) {
      delaySec = Math.max(0, Math.min(120, Math.floor(Number(input.scheduleAiAfterSeconds))))
      visionFastFallback = delaySec === 0
    } else {
      visionFastFallback = input.capReplyDelaySeconds !== undefined
      delaySec = visionFastFallback
        ? Math.min(configuredDelay, Math.max(0, input.capReplyDelaySeconds ?? 0))
        : configuredDelay
      if (mergeDelay > 0) {
        delaySec = Math.max(delaySec, mergeDelay)
      }
    }
    const runAt = new Date(Date.now() + delaySec * 1000).toISOString()
    let scheduled = false
    if (isPgConfigured()) {
      try {
        const ins = await insertPartnerAiJobPg({
          partnerId: input.partnerId,
          conversationId: input.conversationId,
          triggerMessageId: input.messageId,
          runAtIso: runAt,
        })
        scheduled = Boolean(ins?.id)
      } catch (e) {
        console.warn('[partner-ai] schedule job PG failed', e)
      }
    }
    if (!scheduled) {
      console.error('[partner-ai] schedule job: Postgres insert failed')
      return { show: false }
    }

    if (!input.skipEagerBatchRun) {
      try {
        await runMessagingPartnerAiJobBatch(15)
      } catch (e) {
        console.error('[partner-ai] eager batch after schedule', e)
      }
    }

    const scheduledWake =
      process.env.MESSAGING_PARTNER_AI_INLINE_WAKE !== '0' &&
      (process.env.NODE_ENV === 'development' ||
        process.env.MESSAGING_PARTNER_AI_DEV_WAKE === '1' ||
        process.env.MESSAGING_PARTNER_AI_INLINE_WAKE === '1' ||
        process.env.NODE_ENV === 'production')
    if (scheduledWake) {
      const ms = Math.min(delaySec * 1000 + 2500, 900_000)
      setTimeout(() => {
        void (async () => {
          try {
            await runMessagingPartnerAiJobBatch(15)
          } catch (e) {
            console.error('[partner-ai] scheduled wake batch', e)
          }
        })()
      }, ms)
    }

    const maxWaitMs = visionFastFallback
      ? Math.min(Math.max(delaySec * 1000 + 52_000, 72_000), 4 * 60 * 1000)
      : Math.min(Math.max(delaySec * 1000 + 35_000, 60_000), 6 * 60 * 1000)
    return { show: true, maxWaitMs }
  } catch (e) {
    console.error('[partner-ai] inbound hook', e)
    return { show: false }
  }
}
