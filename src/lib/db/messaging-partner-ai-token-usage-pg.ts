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
/** Gom token LLM theo `usage_kind` (null/empty = inbox chat job). */
export type PartnerAiTokenUsageKindStatRow = {
  usage_kind: string | null
  call_count: number
  sum_prompt_tokens: number
  sum_completion_tokens: number
  sum_total_tokens: number
}

export async function fetchMessagingPartnerAiTokenStatsByUsageKindFromPg(
  partnerId: string,
  sinceIso: string
): Promise<PartnerAiTokenUsageKindStatRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      usage_kind: string | null
      call_count: string | number | null
      sum_prompt_tokens: string | number | null
      sum_completion_tokens: string | number | null
      sum_total_tokens: string | number | null
    }>(
      `select
        case
          when u.usage_kind is null or trim(u.usage_kind) = '' then null
          else trim(u.usage_kind)
        end as usage_kind,
        count(*)::bigint as call_count,
        coalesce(sum(u.prompt_tokens), 0)::bigint as sum_prompt_tokens,
        coalesce(sum(u.completion_tokens), 0)::bigint as sum_completion_tokens,
        coalesce(sum(u.total_tokens), 0)::bigint as sum_total_tokens
      from public.messaging_partner_ai_token_usage u
      where u.partner_id = $1::uuid
        and u.created_at >= $2::timestamptz
      group by 1
      order by sum_total_tokens desc nulls last, usage_kind asc nulls first`,
      [partnerId, sinceIso]
    )
    return rows.map((r) => ({
      usage_kind: r.usage_kind == null || String(r.usage_kind).trim() === '' ? null : String(r.usage_kind),
      call_count: Math.max(0, Math.floor(Number(r.call_count ?? 0))),
      sum_prompt_tokens: Math.max(0, Math.floor(Number(r.sum_prompt_tokens ?? 0))),
      sum_completion_tokens: Math.max(0, Math.floor(Number(r.sum_completion_tokens ?? 0))),
      sum_total_tokens: Math.max(0, Math.floor(Number(r.sum_total_tokens ?? 0))),
    }))
  } catch (e) {
    console.warn('[fetchMessagingPartnerAiTokenStatsByUsageKindFromPg]', e)
    return null
  }
}

/** Tổng hợp theo ngày (UTC) trong khoảng thời gian. */
export type PartnerAiTokenDailyStatRow = {
  day_utc: string
  call_count: number
  sum_prompt_tokens: number
  sum_completion_tokens: number
  sum_total_tokens: number
}

export async function fetchMessagingPartnerAiTokenDailyStatsFromPg(
  partnerId: string,
  sinceIso: string
): Promise<PartnerAiTokenDailyStatRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      day_utc: string | Date | null
      call_count: string | number | null
      sum_prompt_tokens: string | number | null
      sum_completion_tokens: string | number | null
      sum_total_tokens: string | number | null
    }>(
      `select
        (date_trunc('day', u.created_at at time zone 'UTC'))::date as day_utc,
        count(*)::bigint as call_count,
        coalesce(sum(u.prompt_tokens), 0)::bigint as sum_prompt_tokens,
        coalesce(sum(u.completion_tokens), 0)::bigint as sum_completion_tokens,
        coalesce(sum(u.total_tokens), 0)::bigint as sum_total_tokens
      from public.messaging_partner_ai_token_usage u
      where u.partner_id = $1::uuid
        and u.created_at >= $2::timestamptz
      group by 1
      order by 1 desc
      limit 120`,
      [partnerId, sinceIso]
    )
    return rows.map((r) => {
      const d = r.day_utc
      const dayStr =
        d instanceof Date
          ? d.toISOString().slice(0, 10)
          : String(d ?? '').slice(0, 10)
      return {
        day_utc: dayStr,
        call_count: Math.max(0, Math.floor(Number(r.call_count ?? 0))),
        sum_prompt_tokens: Math.max(0, Math.floor(Number(r.sum_prompt_tokens ?? 0))),
        sum_completion_tokens: Math.max(0, Math.floor(Number(r.sum_completion_tokens ?? 0))),
        sum_total_tokens: Math.max(0, Math.floor(Number(r.sum_total_tokens ?? 0))),
      }
    })
  } catch (e) {
    console.warn('[fetchMessagingPartnerAiTokenDailyStatsFromPg]', e)
    return null
  }
}

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

export type PartnerAiTokenUsageDetailRow = {
  id: string
  created_at: string
  provider: string
  model: string
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  /** null = chat LLM inbox; image_* | material_infer xem usage_kind trong DB */
  usage_kind: string | null
}

export type PartnerAiImageGenUsageKind = 'image_material_detail' | 'image_real_use'

export type PartnerAiImageGenUsageStatRow = {
  usage_kind: PartnerAiImageGenUsageKind
  call_count: number
  sum_total_tokens: number
}

/** Gom lượt gọi Gemini tạo ảnh (inbox) theo loại — cùng khoảng thời gian với thống kê token LLM. */
export async function fetchMessagingPartnerAiImageGenStatsFromPg(
  partnerId: string,
  sinceIso: string
): Promise<PartnerAiImageGenUsageStatRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      usage_kind: string | null
      call_count: string | number | null
      sum_total_tokens: string | number | null
    }>(
      `select
        u.usage_kind,
        count(*)::bigint as call_count,
        coalesce(sum(u.total_tokens), 0)::bigint as sum_total_tokens
      from public.messaging_partner_ai_token_usage u
      where u.partner_id = $1::uuid
        and u.created_at >= $2::timestamptz
        and u.usage_kind in ('image_material_detail', 'image_real_use')
      group by u.usage_kind
      order by u.usage_kind asc`,
      [partnerId, sinceIso]
    )
    const byKind = new Map<PartnerAiImageGenUsageKind, PartnerAiImageGenUsageStatRow>()
    for (const r of rows) {
      const k = r.usage_kind
      if (k !== 'image_material_detail' && k !== 'image_real_use') continue
      byKind.set(k, {
        usage_kind: k,
        call_count: Math.max(0, Math.floor(Number(r.call_count ?? 0))),
        sum_total_tokens: Math.max(0, Math.floor(Number(r.sum_total_tokens ?? 0))),
      })
    }
    const kinds: PartnerAiImageGenUsageKind[] = ['image_material_detail', 'image_real_use']
    return kinds.map((usage_kind) => {
      const x = byKind.get(usage_kind)
      return (
        x ?? {
          usage_kind,
          call_count: 0,
          sum_total_tokens: 0,
        }
      )
    })
  } catch (e) {
    console.warn('[fetchMessagingPartnerAiImageGenStatsFromPg]', e)
    return null
  }
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

/**
 * Từng lần gọi LLM inbox (mới nhất trước) — thống kê chi tiết token.
 */
export async function fetchMessagingPartnerAiTokenUsageDetailsFromPg(
  partnerId: string,
  sinceIso: string,
  limit: number
): Promise<PartnerAiTokenUsageDetailRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.min(500, Math.max(1, Math.floor(limit)))
  try {
    const rows = await pgQuery<{
      id: string
      created_at: unknown
      provider: string | null
      model: string | null
      prompt_tokens: number | null
      completion_tokens: number | null
      total_tokens: number | null
      usage_kind: string | null
    }>(
      `select
        u.id::text,
        u.created_at,
        u.provider,
        u.model,
        u.prompt_tokens,
        u.completion_tokens,
        u.total_tokens,
        u.usage_kind
      from public.messaging_partner_ai_token_usage u
      where u.partner_id = $1::uuid
        and u.created_at >= $2::timestamptz
      order by u.created_at desc
      limit $3`,
      [partnerId, sinceIso, lim]
    )
    return rows.map((r) => ({
      id: r.id,
      created_at: toIso(r.created_at),
      provider: String(r.provider ?? ''),
      model: String(r.model ?? ''),
      prompt_tokens: r.prompt_tokens == null ? null : Math.max(0, Math.floor(Number(r.prompt_tokens))),
      completion_tokens: r.completion_tokens == null ? null : Math.max(0, Math.floor(Number(r.completion_tokens))),
      total_tokens: r.total_tokens == null ? null : Math.max(0, Math.floor(Number(r.total_tokens))),
      usage_kind: r.usage_kind == null || String(r.usage_kind).trim() === '' ? null : String(r.usage_kind),
    }))
  } catch (e) {
    console.warn('[fetchMessagingPartnerAiTokenUsageDetailsFromPg]', e)
    return null
  }
}
