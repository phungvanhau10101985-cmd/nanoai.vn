import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Db = SupabaseClient<Database>

export type PartnerAiTokenUsageInsert = {
  partner_id: string
  provider?: string
  model: string
  prompt_tokens?: number | null
  completion_tokens?: number | null
  total_tokens?: number | null
  conversation_id?: string | null
  ai_job_id?: string | null
}

export async function insertPartnerAiTokenUsage(db: Db, row: PartnerAiTokenUsageInsert): Promise<void> {
  const prompt = row.prompt_tokens ?? null
  const completion = row.completion_tokens ?? null
  let total = row.total_tokens ?? null
  if (total == null && prompt != null && completion != null) {
    total = prompt + completion
  }
  const { error } = await db.from('messaging_partner_ai_token_usage').insert({
    partner_id: row.partner_id,
    provider: row.provider ?? 'deepseek',
    model: row.model,
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
    conversation_id: row.conversation_id ?? null,
    ai_job_id: row.ai_job_id ?? null,
  })
  if (error) {
    console.warn('[partner-ai-token-usage] insert failed', error.message)
  }
}
