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
  }
): Promise<void> {
  if (input.channel === 'internal') return

  try {
    const { data: settings } = await db
      .from('messaging_partner_ai_settings')
      .select('*')
      .eq('partner_id', input.partnerId)
      .maybeSingle()

    if (!settings?.enabled) return

    const faq = await findMatchingFaq(db, input.partnerId, input.inboundBody)
    if (faq) {
      void runInstantFaq(db, {
        partnerId: input.partnerId,
        conversationId: input.conversationId,
        settings,
        answer: faq.answer,
        faqId: faq.id,
      })
      return
    }

    await cancelPendingAiJobsForConversation(input.conversationId)
    const delaySec = Math.max(15, Math.min(900, settings.reply_delay_seconds ?? 60))
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
      return
    }

    /**
     * Production: bắt buộc cron gọi /api/cron/messaging-partner-ai (serverless không giữ setTimeout sau response).
     * `next dev` (NODE_ENV=development): process sống lâu — hẹn giờ chạy batch để không cần cron local.
     * `next start` local hoặc staging: set MESSAGING_PARTNER_AI_DEV_WAKE=1 nếu chưa có cron.
     */
    const devWake =
      process.env.NODE_ENV === 'development' || process.env.MESSAGING_PARTNER_AI_DEV_WAKE === '1'
    if (devWake) {
      const ms = Math.min(delaySec * 1000 + 2500, 900_000)
      setTimeout(() => {
        void (async () => {
          try {
            await runMessagingPartnerAiJobBatch(createServiceRoleClient(), 15)
          } catch (e) {
            console.error('[partner-ai] dev wake batch', e)
          }
        })()
      }, ms)
    }
  } catch (e) {
    console.error('[partner-ai] inbound hook', e)
  }
}
