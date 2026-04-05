import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database.types'
import type { CustomerCareChannel } from '@/lib/customer-care/types'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { findMatchingFaq } from '@/lib/messaging/partner-ai-faq'
import { deliverAutomatedPartnerMessage } from '@/lib/messaging/partner-ai-deliver'
import { runMessagingPartnerAiJobBatch } from '@/lib/messaging/partner-ai-run-jobs'

type Db = SupabaseClient<Database>
type SettingsRow = Database['public']['Tables']['messaging_partner_ai_settings']['Row']

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function typingDelayMs(settings: SettingsRow): number {
  const a = Math.min(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
  const b = Math.max(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
  return a + Math.floor(Math.random() * Math.max(1, b - a + 1))
}

/** Bảng jobs không có policy JWT — luôn dùng service role. */
export async function cancelPendingAiJobsForConversation(conversationId: string) {
  try {
    const db = createServiceRoleClient()
    await db
      .from('messaging_partner_ai_jobs')
      .update({ status: 'cancelled' })
      .eq('conversation_id', conversationId)
      .eq('status', 'pending')
  } catch (e) {
    console.error('[partner-ai] cancel jobs', e)
  }
}

async function runInstantFaq(
  db: Db,
  ctx: {
    partnerId: string
    conversationId: string
    settings: SettingsRow
    answer: string
    faqId: string
  }
) {
  const { data: conv } = await db.from('customer_care_conversations').select('*').eq('id', ctx.conversationId).single()
  if (!conv) return
  await sleep(typingDelayMs(ctx.settings))
  const rawPayload = { source: 'ai_faq', faq_id: ctx.faqId } as unknown as Json
  const err = await deliverAutomatedPartnerMessage(db, {
    conversation: conv,
    settings: ctx.settings,
    body: ctx.answer,
    rawPayload,
  })
  if (err.error) console.error('[partner-ai] instant FAQ deliver', err.error)
}

/** Gợi ý UI phía khách: hiện “đang trả lời” trong khoảng maxWaitMs (poll nhanh hơn). */
export type PartnerInboundShopTypingHint = { show: false } | { show: true; maxWaitMs: number }

/**
 * Sau mỗi tin inbound từ khách (FB/Zalo/widget/hosted): FAQ tức thì (nền) hoặc lên lịch job AI.
 * Luôn await đến khi job đã insert (hoặc bỏ qua) để serverless không cắt giữa chừng.
 */
export async function handlePartnerInboundForAi(
  db: Db,
  input: {
    partnerId: string
    conversationId: string
    messageId: string
    inboundBody: string
    channel: CustomerCareChannel
    /** Giới hạn reply_delay (giây) — ví dụ khi Vision không có ứng viên, AI chạy sớm hơn. */
    capReplyDelaySeconds?: number
    /**
     * Bỏ qua reply_delay shop: hẹn job sau đúng N giây (vd. chờ khách chọn SP gợi ý Vision).
     * Không dùng chung với capReplyDelaySeconds trong một lần gọi.
     */
    scheduleAiAfterSeconds?: number
  }
): Promise<PartnerInboundShopTypingHint> {
  if (input.channel === 'internal') return { show: false }

  try {
    const { data: settings } = await db
      .from('messaging_partner_ai_settings')
      .select('*')
      .eq('partner_id', input.partnerId)
      .maybeSingle()

    if (!settings?.enabled) return { show: false }

    const faq = await findMatchingFaq(db, input.partnerId, input.inboundBody)
    if (faq) {
      void runInstantFaq(db, {
        partnerId: input.partnerId,
        conversationId: input.conversationId,
        settings,
        answer: faq.answer,
        faqId: faq.id,
      })
      const hi = Math.max(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
      return { show: true, maxWaitMs: hi + 10_000 }
    }

    await cancelPendingAiJobsForConversation(input.conversationId)
    /** Chat bán hàng: chậm nhất ~30s trước khi bắt đầu luồng trả lời (sau đó còn độ trễ gõ). */
    const configuredDelay = Math.max(5, Math.min(30, settings.reply_delay_seconds ?? 20))
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
    }
    const runAt = new Date(Date.now() + delaySec * 1000).toISOString()
    const { error } = await db.from('messaging_partner_ai_jobs').insert({
      partner_id: input.partnerId,
      conversation_id: input.conversationId,
      trigger_message_id: input.messageId,
      run_at: runAt,
      status: 'pending',
    })
    if (error) {
      console.error('[partner-ai] schedule job', error.message)
      return { show: false }
    }

    /**
     * Luôn thử xử lý job đã đến hạn ngay trong request này. Nếu chỉ dựa cron / INLINE_WAKE mà server
     * không cấu hình, khách sẽ không bao giờ nhận tin. Job có run_at trong tương lai không bị pick
     * (một vòng query rẻ); job delay 0 (fallback Vision) hoặc run_at đã qua sẽ chạy LLM tại đây.
     */
    try {
      await runMessagingPartnerAiJobBatch(db, 15)
    } catch (e) {
      console.error('[partner-ai] eager batch after schedule', e)
    }

    /**
     * Luôn thử "wake" cục bộ sau delay (trừ khi tắt tường minh bằng INLINE_WAKE=0):
     * - VPS/PM2 không có cron vẫn xử lý được job delay > 0.
     * - Có cron vẫn an toàn vì runner lock theo trạng thái pending->processing (không gửi trùng).
     * - Serverless có thể không giữ timer sau response; khi đó cron vẫn là đường chính.
     */
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
            await runMessagingPartnerAiJobBatch(createServiceRoleClient(), 15)
          } catch (e) {
            console.error('[partner-ai] scheduled wake batch', e)
          }
        })()
      }, ms)
    }

    /**
     * Poll phía khách: delay ~0 (Vision miss / index chưa sẵn) — cửa sổ ngắn hơn; delay cố định (chờ chọn SP) — cộng thêm LLM.
     */
    const maxWaitMs = visionFastFallback
      ? Math.min(Math.max(delaySec * 1000 + 52_000, 72_000), 4 * 60 * 1000)
      : Math.min(Math.max(delaySec * 1000 + 35_000, 60_000), 6 * 60 * 1000)
    return { show: true, maxWaitMs }
  } catch (e) {
    console.error('[partner-ai] inbound hook', e)
    return { show: false }
  }
}
