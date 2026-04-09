import { insertPartnerAiTokenUsagePg } from '@/lib/db/partner-ai-token-usage-pg'
import { isPgConfigured } from '@/lib/db/pool'

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

/** Ghi token usage — chỉ Postgres. */
export async function insertPartnerAiTokenUsage(row: PartnerAiTokenUsageInsert): Promise<void> {
  if (!isPgConfigured()) {
    console.warn('[partner-ai-token-usage] skipped (no DATABASE_URL)')
    return
  }
  try {
    const ok = await insertPartnerAiTokenUsagePg(row)
    if (!ok) console.warn('[partner-ai-token-usage] insert returned false')
  } catch (e) {
    console.warn('[partner-ai-token-usage] PG insert failed', e)
  }
}
