import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database.types'
import { findMatchingFaq } from '@/lib/messaging/partner-ai-faq'
import { deliverAutomatedPartnerMessage } from '@/lib/messaging/partner-ai-deliver'
import { buildPartnerAiContext, deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'

type Db = SupabaseClient<Database>

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function typingDelayMs(settings: Database['public']['Tables']['messaging_partner_ai_settings']['Row']) {
  const a = Math.min(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
  const b = Math.max(settings.typing_pause_min_ms, settings.typing_pause_max_ms)
  return a + Math.floor(Math.random() * Math.max(1, b - a + 1))
}

export async function runMessagingPartnerAiJobBatch(
  db: Db,
  limit = 12
): Promise<{ claimed: number; completed: number; skipped: number; failed: number }> {
  const nowIso = new Date().toISOString()
  const { data: jobs, error: qErr } = await db
    .from('messaging_partner_ai_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('run_at', nowIso)
    .order('run_at', { ascending: true })
    .limit(limit)

  if (qErr || !jobs?.length) {
    return { claimed: 0, completed: 0, skipped: 0, failed: 0 }
  }

  let completed = 0
  let skipped = 0
  let failed = 0

  for (const job of jobs) {
    const { data: lockRow } = await db
      .from('messaging_partner_ai_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (!lockRow) {
      skipped += 1
      continue
    }

    try {
      const { data: triggerMsg, error: tErr } = await db
        .from('customer_care_messages')
        .select('id, body, created_at')
        .eq('id', job.trigger_message_id)
        .single()

      if (tErr || !triggerMsg) {
        await db
          .from('messaging_partner_ai_jobs')
          .update({ status: 'failed', error: 'Trigger message missing' })
          .eq('id', job.id)
        failed += 1
        continue
      }

      const triggerAt = triggerMsg.created_at

      const { data: humanOut } = await db
        .from('customer_care_messages')
        .select('id')
        .eq('conversation_id', job.conversation_id)
        .eq('direction', 'outbound')
        .not('sender_admin_id', 'is', null)
        .gt('created_at', triggerAt)
        .limit(1)

      if (humanOut?.length) {
        await db.from('messaging_partner_ai_jobs').update({ status: 'cancelled' }).eq('id', job.id)
        skipped += 1
        continue
      }

      const { data: autoOut } = await db
        .from('customer_care_messages')
        .select('id')
        .eq('conversation_id', job.conversation_id)
        .eq('direction', 'outbound')
        .is('sender_admin_id', null)
        .gt('created_at', triggerAt)
        .limit(1)

      if (autoOut?.length) {
        await db.from('messaging_partner_ai_jobs').update({ status: 'done' }).eq('id', job.id)
        completed += 1
        continue
      }

      const { data: conv, error: cErr } = await db
        .from('customer_care_conversations')
        .select('*')
        .eq('id', job.conversation_id)
        .single()

      if (cErr || !conv) {
        await db
          .from('messaging_partner_ai_jobs')
          .update({ status: 'failed', error: 'Conversation missing' })
          .eq('id', job.id)
        failed += 1
        continue
      }

      const { data: settings } = await db
        .from('messaging_partner_ai_settings')
        .select('*')
        .eq('partner_id', job.partner_id)
        .maybeSingle()

      if (!settings?.enabled) {
        await db.from('messaging_partner_ai_jobs').update({ status: 'cancelled' }).eq('id', job.id)
        skipped += 1
        continue
      }

      const faq = await findMatchingFaq(db, job.partner_id, triggerMsg.body)
      if (faq) {
        await sleep(typingDelayMs(settings))
        const rawFaq = { source: 'ai_faq', faq_id: faq.id } as unknown as Json
        const d1 = await deliverAutomatedPartnerMessage(db, {
          conversation: conv,
          settings,
          body: faq.answer,
          rawPayload: rawFaq,
        })
        if (d1.error) {
          await db.from('messaging_partner_ai_jobs').update({ status: 'failed', error: d1.error }).eq('id', job.id)
          failed += 1
        } else {
          await db.from('messaging_partner_ai_jobs').update({ status: 'done' }).eq('id', job.id)
          completed += 1
        }
        continue
      }

      const { system, user } = await buildPartnerAiContext(
        db,
        job.partner_id,
        job.conversation_id,
        settings,
        triggerMsg.body
      )
      const llm = await deepseekPartnerChat(system, user)
      if (llm.error || !llm.text) {
        await db
          .from('messaging_partner_ai_jobs')
          .update({ status: 'failed', error: llm.error || 'empty llm' })
          .eq('id', job.id)
        failed += 1
        continue
      }

      await sleep(typingDelayMs(settings))
      const model = process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat'
      const rawLlm = { source: 'ai_llm', model } as unknown as Json
      const d2 = await deliverAutomatedPartnerMessage(db, {
        conversation: conv,
        settings,
        body: llm.text,
        rawPayload: rawLlm,
      })
      if (d2.error) {
        await db.from('messaging_partner_ai_jobs').update({ status: 'failed', error: d2.error }).eq('id', job.id)
        failed += 1
      } else {
        await db.from('messaging_partner_ai_jobs').update({ status: 'done' }).eq('id', job.id)
        completed += 1
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      await db.from('messaging_partner_ai_jobs').update({ status: 'failed', error: msg }).eq('id', job.id)
      failed += 1
    }
  }

  return { claimed: jobs.length, completed, skipped, failed }
}
