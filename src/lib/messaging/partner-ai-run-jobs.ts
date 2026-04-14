import type { Database, Json } from '@/types/database.types'
import {
  fetchCustomerCareConversationByIdPg,
  fetchCustomerCareMessageByIdPg,
  hasAutoOutboundAfterTriggerPg,
  hasHumanOutboundAfterTriggerPg,
} from '@/lib/db/customer-care-pg'
import { fetchMessagingPartnerAiSettingsFullFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'
import {
  claimPartnerAiJobProcessingPg,
  fetchPendingJobsDueFromPg,
  updatePartnerAiJobStatusPg,
} from '@/lib/db/messaging-partner-ai-jobs-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { findMatchingFaq } from '@/lib/messaging/partner-ai-faq'
import { latestInboundTextForPartnerAi } from '@/lib/messaging/guest-chat-image'
import { inboundTextHasVisionSelectionHint } from '@/lib/messaging/guest-chat-image'
import { deliverAutomatedPartnerMessage } from '@/lib/messaging/partner-ai-deliver'
import { buildPartnerAiContext, deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import { enrichPartnerAiProductCardsWithInventoryVideoFromPg } from '@/lib/messaging/partner-ai-product-cards-enrich-pg'
import { clampProductCardsToLastConsultedRow } from '@/lib/messaging/partner-ai-followup-product-cards-clamp'
import { parsePartnerAiLlmStructured } from '@/lib/messaging/partner-ai-product-cards'
import { insertPartnerAiTokenUsage } from '@/lib/messaging/partner-ai-token-usage'
import { normalizeWebLocale } from '@/lib/i18n/config'

type TriggerRawForVisionRepick = { vision_selected_inventory_id?: string }
type TriggerRawWithVisionSelectedAt = { vision_selected_at?: string }

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

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function uiLocaleFromConversationMetadata(metadata: Json | null | undefined): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const v = (metadata as { ui_locale?: unknown }).ui_locale
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 24) : null
}

function typingDelayMs(settings: Database['public']['Tables']['messaging_partner_ai_settings']['Row']) {
  const a = Math.min(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
  const b = Math.max(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
  return a + Math.floor(Math.random() * Math.max(1, b - a + 1))
}

function shouldSkipTypingDelayForJobChannel(channel: string | null | undefined): boolean {
  return String(channel || '').trim().toLowerCase() === 'widget'
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
      const inboundForAi = latestInboundTextForPartnerAi(triggerFull.body, triggerFull.raw_payload)
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
      const skipTypingDelay = shouldSkipTypingDelayForJobChannel(conv.channel as string | null | undefined)

      const skipFaq = inboundTextHasVisionSelectionHint(inboundForAi)
      const convUiLoc = normalizeWebLocale(uiLocaleFromConversationMetadata(conv.metadata))
      const faq = skipFaq ? null : await findMatchingFaq(job.partner_id, inboundForAi, { locale: convUiLoc })
      if (faq) {
        if (!skipTypingDelay) await sleep(typingDelayMs(settings))
        const rawFaq = { source: 'ai_faq', faq_id: faq.id } as unknown as Json
        const d1 = await deliverAutomatedPartnerMessage({
          conversation: conv,
          settings,
          body: faq.answer,
          rawPayload: rawFaq,
        })
        if (d1.error) {
          await setPartnerAiJobStatus(job.id, { status: 'failed', error: d1.error })
          failed += 1
        } else {
          await setPartnerAiJobStatus(job.id, { status: 'done', error: null })
          completed += 1
        }
        continue
      }

      const {
        system,
        user,
        materialDetailFollowup,
        realUseFollowup,
        useLastConsultedContext,
        lastConsultedRow,
        similarCatalogVersusLastConsulted,
      } = await buildPartnerAiContext(
        job.partner_id,
        job.conversation_id,
        settings,
        inboundForAi,
        triggerFull.raw_payload,
        {
          channel: conv.channel as string | null | undefined,
          uiLocale: convUiLoc,
        }
      )
      const llm = await deepseekPartnerChat(system, user)
      if (llm.error || !llm.text) {
        await setPartnerAiJobStatus(job.id, { status: 'failed', error: llm.error || 'empty llm' })
        failed += 1
        continue
      }

      const model = llm.model?.trim() || 'deepseek-chat'
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

      // Không thêm độ trễ «đang gõ» sau khi LLM đã trả lời — API đã tốn thời gian; chỉ FAQ (nhánh trên) dùng typing_pause_*.
      let parsed = parsePartnerAiLlmStructured(llm.text)
      if (
        useLastConsultedContext &&
        lastConsultedRow &&
        parsed.products.length > 0 &&
        !similarCatalogVersusLastConsulted
      ) {
        parsed = {
          ...parsed,
          products: clampProductCardsToLastConsultedRow(parsed.products, lastConsultedRow),
        }
      }
      const productsWithVideo = await enrichPartnerAiProductCardsWithInventoryVideoFromPg(
        job.partner_id,
        parsed.products
      )
      const rawLlm = {
        source: 'ai_llm',
        model,
        usage: llm.usage ?? null,
        ai_product_cards: productsWithVideo,
      } as unknown as Json
      const d2 = await deliverAutomatedPartnerMessage({
        conversation: conv,
        settings,
        body: parsed.message,
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
