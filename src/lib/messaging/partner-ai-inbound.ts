import type { Database, Json } from '@/types/database.types'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import {
  fetchConversationUiLocaleFromPg,
  fetchCustomerCareConversationByIdPg,
  fetchLastOutboundCustomerCareMessageBodyPg,
  mergeCustomerCareMessageRawPayloadPatchPg,
} from '@/lib/db/customer-care-pg'
import { fetchMessagingPartnerAiSettingsFullFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'
import {
  cancelPendingAiJobsForConversationPg,
  insertPartnerAiJobPg,
} from '@/lib/db/messaging-partner-ai-jobs-pg'
import { isPgConfigured } from '@/lib/db/pool'
import type { CustomerCareChannel } from '@/lib/customer-care/types'
import { findMatchingFaq } from '@/lib/messaging/partner-ai-faq'
import { inboundTextHasVisionSelectionHint } from '@/lib/messaging/guest-chat-image'
import { deliverAutomatedPartnerMessage } from '@/lib/messaging/partner-ai-deliver'
import { runMessagingPartnerAiJobBatch } from '@/lib/messaging/partner-ai-run-jobs'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { inboundTextLooksLikePurchasePickListIntent } from '@/lib/messaging/partner-ai-purchase-intent'
import {
  buildPurchasePickListCardsFromConversation,
  purchasePickListMessageBody,
} from '@/lib/messaging/partner-ai-purchase-pick-list'
import { classifyWidgetInboundIntent } from '@/lib/messaging/partner-ai-widget-intent-classifier'

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
}): Promise<void> {
  if (process.env.PARTNER_AI_WIDGET_INTENT_CLASSIFIER === '0') return
  const raw = (input.intentClassifyText ?? stripInboundBodyForIntentClassify(input.inboundBody)).trim()
  if (raw.length < 1) return
  try {
    const lastShop = await fetchLastOutboundCustomerCareMessageBodyPg(input.conversationId)
    const intent = await classifyWidgetInboundIntent({
      partnerId: input.partnerId,
      customerText: raw,
      lastShopMessage: lastShop,
    })
    if (!intent) return
    await mergeCustomerCareMessageRawPayloadPatchPg(input.messageId, {
      partner_ai_widget_intent: intent,
    })
  } catch (e) {
    console.warn('[partner-ai-inbound] mergePartnerAiWidgetIntentFromClassifier', e)
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

/** Hủy job AI pending — chỉ Postgres. */
export async function cancelPendingAiJobsForConversation(conversationId: string) {
  try {
    if (!isPgConfigured()) return
    await cancelPendingAiJobsForConversationPg(conversationId)
  } catch (e) {
    console.error('[partner-ai] cancel jobs', e)
  }
}

async function runInstantFaq(ctx: {
  partnerId: string
  conversationId: string
  settings: SettingsRow
  answer: string
  faqId: string
  skipTypingDelay?: boolean
}) {
  let conv: Database['public']['Tables']['customer_care_conversations']['Row'] | null = null
  try {
    conv = await fetchCustomerCareConversationByIdPg(ctx.conversationId)
  } catch (e) {
    console.warn('[partner-ai] runInstantFaq PG conv failed', e)
  }
  if (!conv) return
  if (!ctx.skipTypingDelay) {
    await sleep(typingDelayMs(ctx.settings))
  }
  const rawPayload = { source: 'ai_faq', faq_id: ctx.faqId } as unknown as Json
  const err = await deliverAutomatedPartnerMessage({
    conversation: conv,
    settings: ctx.settings,
    body: ctx.answer,
    rawPayload,
  })
  if (err.error) console.error('[partner-ai] instant FAQ deliver', err.error)
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

/** Gợi ý UI phía khách: hiện “đang trả lời” trong khoảng maxWaitMs (poll nhanh hơn). */
export type PartnerInboundShopTypingHint = { show: false } | { show: true; maxWaitMs: number }

/**
 * Sau mỗi tin inbound từ khách (FB/Zalo/widget/hosted): FAQ tức thì (nền) hoặc lên lịch job AI.
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
  /** Widget: locale vừa merge (vi/en/…) — chọn bản FAQ trong `answer_i18n`. */
  widgetUiLocale?: string | null
  /** Tin thuần để phân loại ý định (khác `inboundBody` khi có dòng [Customer product …]). */
  intentClassifyText?: string | null
}): Promise<PartnerInboundShopTypingHint> {
  if (input.channel === 'internal') return { show: false }

  try {
    const settings = await fetchMessagingPartnerAiSettingsFullFromPg(input.partnerId)

    if (!settings?.enabled) return { show: false }

    await mergePartnerAiWidgetIntentFromClassifier({
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
    const faq = skipFaq ? null : await findMatchingFaq(input.partnerId, input.inboundBody, { locale: faqLocale })
    if (faq) {
      /** Nền: sleep theo `typing_pause_*` rồi mới gửi — khách thấy «shop đang trả lời» trong lúc đó (maxWaitMs bên dưới). */
      void runInstantFaq({
        partnerId: input.partnerId,
        conversationId: input.conversationId,
        settings,
        answer: faq.answer,
        faqId: faq.id,
      })
      const typingHi = Math.max(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
      return { show: true, maxWaitMs: typingHi + 10_000 }
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
    if (!skipPurchasePickBranch && inboundTextLooksLikePurchasePickListIntent(input.inboundBody)) {
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
        : Math.max(0, Math.min(30, settings.reply_delay_seconds ?? 0))
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
