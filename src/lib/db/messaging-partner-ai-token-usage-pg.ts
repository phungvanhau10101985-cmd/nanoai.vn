import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

export type PartnerAiTokenUsageStatRow = {
  provider: string
  model: string
  call_count: number
  sum_prompt_tokens: number
  sum_completion_tokens: number
  sum_total_tokens: number
}

/**
 * Tương đương RPC `messaging_partner_ai_token_stats_by_model` (API REST hosted trước đây).
 * Gom theo provider + model trong khoảng thời gian.
 */
export async function fetchMessagingPartnerAiTokenStatsByModelFromPg(
  partnerId: string,
  sinceIso: string
): Promise<PartnerAiTokenUsageStatRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      provider: string | null
      model: string | null
      call_count: string | number | null
      sum_prompt_tokens: string | number | null
      sum_completion_tokens: string | number | null
      sum_total_tokens: string | number | null
    }>(
      `select
        u.provider,
        u.model,
        count(*)::bigint as call_count,
        coalesce(sum(u.prompt_tokens), 0)::bigint as sum_prompt_tokens,
        coalesce(sum(u.completion_tokens), 0)::bigint as sum_completion_tokens,
        coalesce(sum(u.total_tokens), 0)::bigint as sum_total_tokens
      from public.messaging_partner_ai_token_usage u
      where u.partner_id = $1::uuid
        and u.created_at >= $2::timestamptz
      group by u.provider, u.model
      order by sum_total_tokens desc nulls last, u.model asc`,
      [partnerId, sinceIso]
    )
    return rows.map((r) => ({
      provider: String(r.provider ?? ''),
      model: String(r.model ?? ''),
      call_count: Math.max(0, Math.floor(Number(r.call_count ?? 0))),
      sum_prompt_tokens: Math.max(0, Math.floor(Number(r.sum_prompt_tokens ?? 0))),
      sum_completion_tokens: Math.max(0, Math.floor(Number(r.sum_completion_tokens ?? 0))),
      sum_total_tokens: Math.max(0, Math.floor(Number(r.sum_total_tokens ?? 0))),
    }))
  } catch (e) {
    console.warn('[fetchMessagingPartnerAiTokenStatsByModelFromPg]', e)
    return null
  }
}
