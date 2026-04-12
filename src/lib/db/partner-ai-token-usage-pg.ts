import type { PartnerAiTokenUsageInsert } from '@/lib/messaging/partner-ai-token-usage'

import { pgQuery } from '@/lib/db/pg-query'

import { isPgConfigured } from '@/lib/db/pool'



export async function insertPartnerAiTokenUsagePg(row: PartnerAiTokenUsageInsert): Promise<boolean> {

  if (!isPgConfigured()) return false

  const prompt = row.prompt_tokens ?? null

  const completion = row.completion_tokens ?? null

  let total = row.total_tokens ?? null

  if (total == null && prompt != null && completion != null) {

    total = prompt + completion

  }

  try {

    await pgQuery(

      `insert into public.messaging_partner_ai_token_usage (

         partner_id, provider, model, prompt_tokens, completion_tokens, total_tokens,

         conversation_id, ai_job_id, usage_kind

       ) values (

         $1::uuid, $2, $3, $4, $5, $6, $7::uuid, $8::uuid, $9

       )`,

      [

        row.partner_id,

        row.provider ?? 'deepseek',

        row.model,

        prompt,

        completion,

        total,

        row.conversation_id ?? null,

        row.ai_job_id ?? null,

        row.usage_kind ?? null,

      ]

    )

    return true

  } catch (e) {

    console.warn('[partner-ai-token-usage-pg] insert failed', e)

    return false

  }

}

