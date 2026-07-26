import type { Database, Json } from '@/types/database.types'
import {
  fetchCustomerCareConversationByIdPg,
  fetchCustomerCareMessageByIdPg,
  fetchInboundTailForPartnerAiJobPg,
  hasAutoOutboundAfterTriggerPg,
  hasHumanOutboundAfterTriggerPg,
} from '@/lib/db/customer-care-pg'
import { fetchMessagingPartnerAiSettingsFullFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'
import {
  claimPartnerAiJobProcessingPg,
  fetchPendingJobsDueFromPg,
  partnerAiJobIsStillProcessingPg,
  updatePartnerAiJobStatusPg,
} from '@/lib/db/messaging-partner-ai-jobs-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { latestInboundTextForPartnerAi } from '@/lib/messaging/guest-chat-image'
import { deliverAutomatedPartnerMessage } from '@/lib/messaging/partner-ai-deliver'
import {
  buildPartnerAiContext,
  deepseekPartnerChat,
  rawPayloadIsProductCardConsult,
} from '@/lib/messaging/partner-ai-llm'
import {
  fetchGuestGenderForPartnerConsultCachePg,
  fetchSafeSkuIsolatedProductConsultCacheFromPg,
  upsertSafeSkuIsolatedProductConsultCachePg,
} from '@/lib/db/partner-product-consult-cache-pg'
import { enforceConfiguredGenderAddressing } from '@/lib/messaging/partner-ai-gender-addressing'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { enrichPartnerAiProductCardsWithInventoryVideoFromPg } from '@/lib/messaging/partner-ai-product-cards-enrich-pg'
import {
  clampProductCardsToLastConsultedRow,
  partnerAiProductCardFromInventoryRow,
} from '@/lib/messaging/partner-ai-followup-product-cards-clamp'
import { parsePartnerAiLlmStructured } from '@/lib/messaging/partner-ai-product-cards'
import { insertPartnerAiTokenUsage } from '@/lib/messaging/partner-ai-token-usage'
import { resolveDeepSeekChatModel } from '@/lib/deepseek-api'
import { DEFAULT_WEB_LOCALE, normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']
type TriggerRawForVisionRepick = { vision_selected_inventory_id?: string }
type TriggerRawWithVisionSelectedAt = { vision_selected_at?: string }

const BAG_ACCESSORY_KEYWORDS = [
  'tui',
  'túi',
  'ba lo',
  'ba lô',
  'balo',
  'backpack',
  'handbag',
  'shoulder bag',
  'crossbody',
  'wallet',
  'vi',
  'ví',
  'purse',
  'clutch',
  'tote',
  'vali',
]
const SHOE_SIZE_ASK_RE =
  /(size\s*gi[aà]y|th(?:u|ươ)ờng\s*đi\s*size|đi\s*size\s*bao\s*nhi[eê]u|c(?:ơ|ỡ)\s*gi[aà]y)/iu
const SHOE_SIZE_SENTENCE_RE =
  /(?:[.!?]\s*)?(?:anh|chị|ban|bạn|mình)?\s*(?:cho em hỏi\s*)?(?:th(?:u|ươ)ờng\s*đi\s*size(?:\s*gi[aà]y)?\s*bao\s*nhi[eê]u|size\s*gi[aà]y\s*bao\s*nhi[eê]u|c(?:ơ|ỡ)\s*gi[aà]y\s*bao\s*nhi[eê]u)\s*(?:để\s*em\s*tư\s*vấn\s*thêm)?\s*[.!?]?/giu
const BAG_FIT_FALLBACK_QUESTION = 'Mình thường dùng mẫu này cho nhu cầu nào để em tư vấn kích thước phù hợp hơn ạ?'

function stripVietnameseDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
}

function inventoryRowLooksLikeBagAccessory(row: InvRow | null | undefined): boolean {
  if (!row) return false
  const haystackRaw = [row.name, row.description, row.stock_note, row.consult_note, row.material_note]
    .map((s) => (s ?? '').trim())
    .join(' ')
    .toLowerCase()
  if (!haystackRaw) return false
  const haystack = `${haystackRaw} ${stripVietnameseDiacritics(haystackRaw)}`
  return BAG_ACCESSORY_KEYWORDS.some((kw) => haystack.includes(kw))
}

function sanitizeFashionFitQuestionForBag(message: string, row: InvRow | null | undefined): string {
  const raw = message.trim()
  if (!raw || !row) return message
  if (!inventoryRowLooksLikeBagAccessory(row)) return message
  if (!SHOE_SIZE_ASK_RE.test(raw)) return message

  const replaced = raw.replace(SHOE_SIZE_SENTENCE_RE, ' ').replace(/\s+([,.;!?])/g, '$1').replace(/\s{2,}/g, ' ')
  const normalized = replaced.trim().replace(/[,\s]+$/, '')
  if (!normalized) return BAG_FIT_FALLBACK_QUESTION
  if (/[.!?]$/.test(normalized)) return normalized
  return `${normalized}. ${BAG_FIT_FALLBACK_QUESTION}`
}

function hasVisionRepickSelection(raw: Json | null | undefined): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const sid = (raw as TriggerRawForVisionRepick).vision_selected_inventory_id
  return typeof sid === 'string' && sid.trim().length > 0
}

function getVisionSelectedAtEpochMs(raw: Json | null | undefined): number | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = (raw as TriggerRawWithVisionSelectedAt).vision_selected_at
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  const ms = Date.parse(s)
  return Number.isFinite(ms) ? ms : null
}

function uiLocaleFromConversationMetadata(metadata: Json | null | undefined): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const v = (metadata as { ui_locale?: unknown }).ui_locale
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 24) : null
}

async function setPartnerAiJobStatus(
  jobId: string,
  patch: { status: Database['public']['Tables']['messaging_partner_ai_jobs']['Row']['status']; error?: string | null }
) {
  if (!isPgConfigured()) return
  const ok = await updatePartnerAiJobStatusPg(jobId, {
    status: patch.status,
    error: patch.error ?? null,
  })
  if (!ok) {
    console.warn('[partner-ai-run-jobs] update job status failed', jobId)
  }
}

async function resolveHumanOutboundAfterTrigger(conversationId: string, triggerAtIso: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const v = await hasHumanOutboundAfterTriggerPg(conversationId, triggerAtIso)
  return v === true
}

async function resolveAutoOutboundAfterTrigger(conversationId: string, triggerAtIso: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const v = await hasAutoOutboundAfterTriggerPg(conversationId, triggerAtIso)
  return v === true
}

async function runMessagingPartnerAiJobBatchUsingPg(
  limit: number
): Promise<{ claimed: number; completed: number; skipped: number; failed: number } | null> {
  const nowIso = new Date().toISOString()
  const jobs = await fetchPendingJobsDueFromPg(nowIso, limit)
  if (jobs === null) return null
  if (!jobs.length) return { claimed: 0, completed: 0, skipped: 0, failed: 0 }

  let completed = 0
  let skipped = 0
  let failed = 0

  for (const job of jobs) {
    const locked = await claimPartnerAiJobProcessingPg(job.id)
    if (!locked) {
      skipped += 1
      continue
    }

    try {
      const triggerFull = await fetchCustomerCareMessageByIdPg(job.trigger_message_id)
      if (!triggerFull) {
        await setPartnerAiJobStatus(job.id, { status: 'failed', error: 'Trigger message missing' })
        failed += 1
        continue
      }

      const triggerAt = triggerFull.created_at
      let inboundForAi = latestInboundTextForPartnerAi(triggerFull.body, triggerFull.raw_payload)
      let effectiveTriggerRawPayloadForAi = triggerFull.raw_payload
      const inboundTail = await fetchInboundTailForPartnerAiJobPg(job.conversation_id, triggerAt)
      if (inboundTail && inboundTail.length > 0) {
        let latestProductCardConsultTail: (typeof inboundTail)[number] | null = null
        for (let i = inboundTail.length - 1; i >= 0; i--) {
          if (rawPayloadIsProductCardConsult(inboundTail[i].raw_payload)) {
            latestProductCardConsultTail = inboundTail[i]
            break
          }
        }
        const parts = inboundTail
          .map((row) => latestInboundTextForPartnerAi(row.body, row.raw_payload))
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
        if (latestProductCardConsultTail) {
          inboundForAi = latestInboundTextForPartnerAi(
            latestProductCardConsultTail.body,
            latestProductCardConsultTail.raw_payload
          ).trim()
          effectiveTriggerRawPayloadForAi = latestProductCardConsultTail.raw_payload
        } else if (parts.length > 0) {
          inboundForAi = parts.join('\n\n')
        }
      }
      const allowRepeatedReplyForVisionPick = hasVisionRepickSelection(triggerFull.raw_payload)
      const visionSelectedAtMs = getVisionSelectedAtEpochMs(triggerFull.raw_payload)
      const jobCreatedAtMs = Date.parse(String(job.created_at ?? ''))
      if (
        allowRepeatedReplyForVisionPick &&
        visionSelectedAtMs !== null &&
        Number.isFinite(jobCreatedAtMs) &&
        jobCreatedAtMs + 30_000 < visionSelectedAtMs
      ) {
        await setPartnerAiJobStatus(job.id, { status: 'cancelled', error: null })
        skipped += 1
        continue
      }

      const hasHuman = await resolveHumanOutboundAfterTrigger(job.conversation_id, triggerAt)
      if (hasHuman) {
        await setPartnerAiJobStatus(job.id, { status: 'cancelled', error: null })
        skipped += 1
        continue
      }

      if (!allowRepeatedReplyForVisionPick) {
        const hasAuto = await resolveAutoOutboundAfterTrigger(job.conversation_id, triggerAt)
        if (hasAuto) {
          await setPartnerAiJobStatus(job.id, { status: 'done', error: null })
          completed += 1
          continue
        }
      }

      const conv = await fetchCustomerCareConversationByIdPg(job.conversation_id)
      if (!conv) {
        await setPartnerAiJobStatus(job.id, { status: 'failed', error: 'Conversation missing' })
        failed += 1
        continue
      }

      const settings = await fetchMessagingPartnerAiSettingsFullFromPg(job.partner_id)

      if (!settings?.enabled) {
        await setPartnerAiJobStatus(job.id, { status: 'cancelled', error: null })
        skipped += 1
        continue
      }
      const convUiLoc = normalizeWebLocale(uiLocaleFromConversationMetadata(conv.metadata))
      const configuredGender = await fetchGuestGenderForPartnerConsultCachePg(conv.linked_user_id)

      const cacheUiLocale: WebLocale = convUiLoc ?? DEFAULT_WEB_LOCALE

      const {
        system,
        user,
        materialDetailFollowup,
        realUseFollowup,
        useLastConsultedContext,
        lastConsultedRow,
        similarCatalogVersusLastConsulted,
        clarifyShoppingIntent,
        forceSingleRowContextReply,
        inboundAnchoredProductConsultBranch,
        inboundAnchoredConsultRow,
        inboundPageSkuMissImageSimilarFallback,
        similarAlternativesTemplateInventoryRows,
        newProductSearchTemplateInventoryRows,
        partnerAiRouteIntent,
        partnerAiSalesStage,
        partnerAiCtaStrategy,
        specificAnglePhotoRequest,
        specificAnglePhotoTemplateInventoryRows,
      } = await buildPartnerAiContext(
        job.partner_id,
        job.conversation_id,
        settings,
        inboundForAi,
        effectiveTriggerRawPayloadForAi,
        {
          channel: conv.channel as string | null | undefined,
          uiLocale: convUiLoc,
        }
      )

      if ((await partnerAiJobIsStillProcessingPg(job.id)) === false) {
        skipped += 1
        continue
      }

      if (
        !clarifyShoppingIntent &&
        specificAnglePhotoRequest &&
        specificAnglePhotoTemplateInventoryRows &&
        specificAnglePhotoTemplateInventoryRows.length > 0 &&
        !materialDetailFollowup &&
        !realUseFollowup
      ) {
        if ((await partnerAiJobIsStillProcessingPg(job.id)) === false) {
          skipped += 1
          continue
        }
        const dict = getDictionary(cacheUiLocale)
        const cards = specificAnglePhotoTemplateInventoryRows
          .map((row) => partnerAiProductCardFromInventoryRow(row))
          .filter((c): c is PartnerAiProductCard => Boolean(c))
        const productsTemplate = await enrichPartnerAiProductCardsWithInventoryVideoFromPg(job.partner_id, cards)
        const rawAnglePhotoTemplate = {
          source: 'photo_angle_detail_template',
          model: null,
          usage: null,
          ai_product_cards: productsTemplate,
          ...(partnerAiRouteIntent ? { partner_ai_route_intent: partnerAiRouteIntent } : {}),
          ...(partnerAiSalesStage ? { partner_ai_sales_stage: partnerAiSalesStage } : {}),
          ...(partnerAiCtaStrategy ? { partner_ai_cta_strategy: partnerAiCtaStrategy } : {}),
          partner_ai_pipeline_branch: 'photo_angle_detail_template' as const,
        } as unknown as Json
        const dTpl = await deliverAutomatedPartnerMessage({
          conversation: conv,
          settings,
          body: enforceConfiguredGenderAddressing(
            dict.partnerGuestChat.photoAngleDetailTemplateMessage,
            configuredGender
          ),
          rawPayload: rawAnglePhotoTemplate,
          materialDetailFollowup: null,
          realUseFollowup: null,
        })
        if (dTpl.error) {
          await setPartnerAiJobStatus(job.id, { status: 'failed', error: dTpl.error })
          failed += 1
        } else {
          await setPartnerAiJobStatus(job.id, { status: 'done', error: null })
          completed += 1
        }
        continue
      }

      if (
        !clarifyShoppingIntent &&
        similarAlternativesTemplateInventoryRows &&
        similarAlternativesTemplateInventoryRows.length > 0 &&
        !materialDetailFollowup &&
        !realUseFollowup
      ) {
        if ((await partnerAiJobIsStillProcessingPg(job.id)) === false) {
          skipped += 1
          continue
        }
        const dict = getDictionary(cacheUiLocale)
        const cards = similarAlternativesTemplateInventoryRows
          .map((row) => partnerAiProductCardFromInventoryRow(row))
          .filter((c): c is PartnerAiProductCard => Boolean(c))
        const productsTemplate = await enrichPartnerAiProductCardsWithInventoryVideoFromPg(job.partner_id, cards)
        const rawSimilarTemplate = {
          source: 'similar_catalog_template',
          model: null,
          usage: null,
          ai_product_cards: productsTemplate,
          ...(partnerAiRouteIntent ? { partner_ai_route_intent: partnerAiRouteIntent } : {}),
          ...(partnerAiSalesStage ? { partner_ai_sales_stage: partnerAiSalesStage } : {}),
          ...(partnerAiCtaStrategy ? { partner_ai_cta_strategy: partnerAiCtaStrategy } : {}),
          partner_ai_pipeline_branch: 'similar_alternatives_catalog' as const,
        } as unknown as Json
        const dTpl = await deliverAutomatedPartnerMessage({
          conversation: conv,
          settings,
          body: enforceConfiguredGenderAddressing(
            dict.partnerGuestChat.similarAlternativesTemplateMessage,
            configuredGender
          ),
          rawPayload: rawSimilarTemplate,
          materialDetailFollowup: null,
          realUseFollowup: null,
        })
        if (dTpl.error) {
          await setPartnerAiJobStatus(job.id, { status: 'failed', error: dTpl.error })
          failed += 1
        } else {
          await setPartnerAiJobStatus(job.id, { status: 'done', error: null })
          completed += 1
        }
        continue
      }

      if (
        !clarifyShoppingIntent &&
        partnerAiRouteIntent === 'new_product_search' &&
        newProductSearchTemplateInventoryRows &&
        newProductSearchTemplateInventoryRows.length > 0 &&
        !materialDetailFollowup &&
        !realUseFollowup
      ) {
        if ((await partnerAiJobIsStillProcessingPg(job.id)) === false) {
          skipped += 1
          continue
        }
        const dict = getDictionary(cacheUiLocale)
        const cards = newProductSearchTemplateInventoryRows
          .map((row) => partnerAiProductCardFromInventoryRow(row))
          .filter((c): c is PartnerAiProductCard => Boolean(c))
        const productsTemplate = await enrichPartnerAiProductCardsWithInventoryVideoFromPg(job.partner_id, cards)
        const rawProductSearchTemplate = {
          source: 'product_search_template',
          model: null,
          usage: null,
          ai_product_cards: productsTemplate,
          ...(partnerAiRouteIntent ? { partner_ai_route_intent: partnerAiRouteIntent } : {}),
          ...(partnerAiSalesStage ? { partner_ai_sales_stage: partnerAiSalesStage } : {}),
          ...(partnerAiCtaStrategy ? { partner_ai_cta_strategy: partnerAiCtaStrategy } : {}),
          partner_ai_pipeline_branch: 'new_product_search_template' as const,
        } as unknown as Json
        const dTpl = await deliverAutomatedPartnerMessage({
          conversation: conv,
          settings,
          body: enforceConfiguredGenderAddressing(
            dict.partnerGuestChat.productSearchTemplateMessage,
            configuredGender
          ),
          rawPayload: rawProductSearchTemplate,
          materialDetailFollowup: null,
          realUseFollowup: null,
        })
        if (dTpl.error) {
          await setPartnerAiJobStatus(job.id, { status: 'failed', error: dTpl.error })
          failed += 1
        } else {
          await setPartnerAiJobStatus(job.id, { status: 'done', error: null })
          completed += 1
        }
        continue
      }

      if (
        partnerAiRouteIntent === 'card_consult_isolated' &&
        inboundAnchoredConsultRow &&
        configuredGender &&
        !materialDetailFollowup &&
        !realUseFollowup
      ) {
        try {
          const cached = await fetchSafeSkuIsolatedProductConsultCacheFromPg(
            job.partner_id,
            inboundAnchoredConsultRow.id,
            configuredGender,
            cacheUiLocale
          )
          if (cached?.message_text) {
            if ((await partnerAiJobIsStillProcessingPg(job.id)) === false) {
              skipped += 1
              continue
            }
            let cachedCards = Array.isArray(cached.ai_product_cards)
              ? (cached.ai_product_cards as PartnerAiProductCard[])
              : []
            cachedCards = clampProductCardsToLastConsultedRow(cachedCards, inboundAnchoredConsultRow)
            if (cachedCards.length === 0) {
              const fb = partnerAiProductCardFromInventoryRow(inboundAnchoredConsultRow)
              if (fb) cachedCards = [fb]
            }
            const productsWithVideoCached = await enrichPartnerAiProductCardsWithInventoryVideoFromPg(
              job.partner_id,
              cachedCards
            )
            const rawCached = {
              source: 'ai_llm',
              model: 'safe_sku_isolated_product_consult_cache',
              usage: null,
              ai_product_cards: productsWithVideoCached,
              partner_ai_cache: {
                kind: 'sku_isolated_product_consult',
                hit: true,
                version: 'v2',
              },
              ...(partnerAiRouteIntent ? { partner_ai_route_intent: partnerAiRouteIntent } : {}),
              ...(partnerAiSalesStage ? { partner_ai_sales_stage: partnerAiSalesStage } : {}),
              ...(partnerAiCtaStrategy ? { partner_ai_cta_strategy: partnerAiCtaStrategy } : {}),
              partner_ai_pipeline_branch: partnerAiRouteIntent,
            } as unknown as Json
            const cachedMessage = sanitizeFashionFitQuestionForBag(
              cached.message_text,
              inboundAnchoredConsultRow
            )
            const dCache = await deliverAutomatedPartnerMessage({
              conversation: conv,
              settings,
              body: enforceConfiguredGenderAddressing(cachedMessage, configuredGender),
              rawPayload: rawCached,
              materialDetailFollowup: null,
              realUseFollowup: null,
            })
            if (dCache.error) {
              await setPartnerAiJobStatus(job.id, { status: 'failed', error: dCache.error })
              failed += 1
            } else {
              await setPartnerAiJobStatus(job.id, { status: 'done', error: null })
              completed += 1
            }
            continue
          }
        } catch (e) {
          console.warn('[partner-ai-run-jobs] safe sku isolated cache read', e)
        }
      }

      if ((await partnerAiJobIsStillProcessingPg(job.id)) === false) {
        skipped += 1
        continue
      }

      const llm = await deepseekPartnerChat(system, user, {
        feature: 'messaging-partner-ai-job',
        userId: conv.linked_user_id ?? null,
      })
      if (llm.error || !llm.text) {
        await setPartnerAiJobStatus(job.id, { status: 'failed', error: llm.error || 'empty llm' })
        failed += 1
        continue
      }

      if ((await partnerAiJobIsStillProcessingPg(job.id)) === false) {
        skipped += 1
        continue
      }

      const model = llm.model?.trim() || resolveDeepSeekChatModel()
      await insertPartnerAiTokenUsage({
        partner_id: job.partner_id,
        provider: 'deepseek',
        model,
        prompt_tokens: llm.usage?.prompt_tokens ?? null,
        completion_tokens: llm.usage?.completion_tokens ?? null,
        total_tokens: llm.usage?.total_tokens ?? null,
        conversation_id: job.conversation_id,
        ai_job_id: job.id,
      })

      // Không thêm độ trễ «đang gõ» sau khi LLM đã trả lời — API đã tốn thời gian.
      let parsed = parsePartnerAiLlmStructured(llm.text)
      if (clarifyShoppingIntent) {
        parsed = { ...parsed, products: [] }
      }
      if (
        !clarifyShoppingIntent &&
        useLastConsultedContext &&
        lastConsultedRow &&
        !similarCatalogVersusLastConsulted &&
        !inboundPageSkuMissImageSimilarFallback
      ) {
        let nextProducts = parsed.products
        if (nextProducts.length > 0) {
          nextProducts = clampProductCardsToLastConsultedRow(nextProducts, lastConsultedRow)
        }
        if (nextProducts.length === 0) {
          const fb = partnerAiProductCardFromInventoryRow(lastConsultedRow)
          if (fb) nextProducts = [fb]
        }
        parsed = { ...parsed, products: nextProducts }
      }
      if (forceSingleRowContextReply) {
        let nextProducts = parsed.products
        if (lastConsultedRow) {
          nextProducts = clampProductCardsToLastConsultedRow(nextProducts, lastConsultedRow)
          if (nextProducts.length === 0) {
            const fb = partnerAiProductCardFromInventoryRow(lastConsultedRow)
            if (fb) nextProducts = [fb]
          }
        }
        if (nextProducts.length > 1) nextProducts = nextProducts.slice(0, 1)
        parsed = { ...parsed, products: nextProducts }
      }
      /** Nhánh B — neo SP từ link/payload: clamp thẻ về đúng một dòng kho, tách khỏi carousel tìm rộng. */
      if (!clarifyShoppingIntent && inboundAnchoredProductConsultBranch && inboundAnchoredConsultRow) {
        let nextProducts = parsed.products
        nextProducts = clampProductCardsToLastConsultedRow(nextProducts, inboundAnchoredConsultRow)
        if (nextProducts.length === 0) {
          const fb = partnerAiProductCardFromInventoryRow(inboundAnchoredConsultRow)
          if (fb) nextProducts = [fb]
        }
        if (nextProducts.length > 1) nextProducts = nextProducts.slice(0, 1)
        parsed = { ...parsed, products: nextProducts }
      }
      const fitQuestionGuardRow =
        inboundAnchoredConsultRow ??
        (useLastConsultedContext && lastConsultedRow && !similarCatalogVersusLastConsulted
          ? lastConsultedRow
          : null)
      parsed = { ...parsed, message: sanitizeFashionFitQuestionForBag(parsed.message, fitQuestionGuardRow) }
      const productsWithVideo = await enrichPartnerAiProductCardsWithInventoryVideoFromPg(
        job.partner_id,
        parsed.products
      )
      const rawLlm = {
        source: 'ai_llm',
        model,
        usage: llm.usage ?? null,
        ai_product_cards: productsWithVideo,
        ...(partnerAiRouteIntent ? { partner_ai_route_intent: partnerAiRouteIntent } : {}),
        ...(partnerAiSalesStage ? { partner_ai_sales_stage: partnerAiSalesStage } : {}),
        ...(partnerAiCtaStrategy ? { partner_ai_cta_strategy: partnerAiCtaStrategy } : {}),
        ...(partnerAiRouteIntent
          ? { partner_ai_pipeline_branch: partnerAiRouteIntent }
          : inboundAnchoredProductConsultBranch
            ? { partner_ai_pipeline_branch: 'inbound_anchored_product_consult' as const }
            : inboundPageSkuMissImageSimilarFallback
              ? { partner_ai_pipeline_branch: 'page_context_image_similar_fallback' as const }
              : similarCatalogVersusLastConsulted
                ? { partner_ai_pipeline_branch: 'similar_alternatives_catalog' as const }
                : {}),
      } as unknown as Json
      if ((await partnerAiJobIsStillProcessingPg(job.id)) === false) {
        skipped += 1
        continue
      }
      const d2 = await deliverAutomatedPartnerMessage({
        conversation: conv,
        settings,
        body: enforceConfiguredGenderAddressing(parsed.message, configuredGender),
        rawPayload: rawLlm,
        materialDetailFollowup,
        realUseFollowup,
      })
      if (d2.error) {
        await setPartnerAiJobStatus(job.id, { status: 'failed', error: d2.error })
        failed += 1
      } else {
        await setPartnerAiJobStatus(job.id, { status: 'done', error: null })
        completed += 1
        if (
          partnerAiRouteIntent === 'card_consult_isolated' &&
          inboundAnchoredConsultRow &&
          configuredGender &&
          !materialDetailFollowup &&
          !realUseFollowup &&
          productsWithVideo.length > 0
        ) {
          void upsertSafeSkuIsolatedProductConsultCachePg({
            partnerId: job.partner_id,
            inventoryId: inboundAnchoredConsultRow.id,
            gender: configuredGender,
            uiLocale: cacheUiLocale,
            messageText: parsed.message,
            aiProductCards: productsWithVideo as unknown as Json,
          })
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      await setPartnerAiJobStatus(job.id, { status: 'failed', error: msg })
      failed += 1
    }
  }

  return { claimed: jobs.length, completed, skipped, failed }
}

/** Xử lý batch job AI — chỉ Postgres (`DATABASE_URL`). */
export async function runMessagingPartnerAiJobBatch(
  limit = 12
): Promise<{ claimed: number; completed: number; skipped: number; failed: number }> {
  if (!isPgConfigured()) {
    return { claimed: 0, completed: 0, skipped: 0, failed: 0 }
  }
  try {
    const pg = await runMessagingPartnerAiJobBatchUsingPg(limit)
    if (pg !== null) return pg
  } catch (e) {
    console.warn('[partner-ai-run-jobs] PG batch failed', e)
  }
  return { claimed: 0, completed: 0, skipped: 0, failed: 0 }
}
