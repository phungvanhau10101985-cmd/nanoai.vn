import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type LanguageCoachCreditEventRow = {
  charge_type: string
  amount: number | string | null
}

/**
 * Doanh thu (tổng amount) từ giao dịch `payments` đã hoàn thành,
 * có thời điểm tính = coalesce(completed_at, created_at) trong [fromIso, toIso].
 */
export async function fetchRevenueFromCompletedPaymentsInRange(fromIso: string, toIso: string): Promise<number> {
  if (!isPgConfigured()) return 0
  const row = await pgQueryOne<{ s: string | null }>(
    `select coalesce(sum(amount::numeric), 0)::text as s
     from public.payments
     where status = 'completed'
       and coalesce(completed_at, created_at) >= $1::timestamptz
       and coalesce(completed_at, created_at) <= $2::timestamptz`,
    [fromIso, toIso]
  )
  const n = Number(row?.s ?? 0)
  return Number.isFinite(n) ? n : 0
}

export async function fetchLanguageCoachCreditEventsInRange(
  fromIso: string,
  toIso: string
): Promise<LanguageCoachCreditEventRow[]> {
  if (!isPgConfigured()) return []
  return pgQuery<LanguageCoachCreditEventRow>(
    `select charge_type, amount::float8 as amount
     from public.language_coach_credit_events
     where created_at >= $1::timestamptz and created_at <= $2::timestamptz`,
    [fromIso, toIso]
  )
}

export async function sumMusicChargedCreditsInRange(fromIso: string, toIso: string): Promise<number> {
  if (!isPgConfigured()) return 0
  const row = await pgQueryOne<{ s: string | null }>(
    `select coalesce(sum(charged_credits::numeric), 0)::text as s
     from public.music_generations
     where created_at >= $1::timestamptz and created_at <= $2::timestamptz`,
    [fromIso, toIso]
  )
  const n = Number(row?.s ?? 0)
  return Number.isFinite(n) ? n : 0
}

export type MessagingPartnerTokenUsageByShopModelRow = {
  partner_id: string
  partner_slug: string
  partner_display_name: string
  owner_user_id: string | null
  owner_email: string | null
  model: string
  call_count: number
  sum_prompt_tokens: number
  sum_completion_tokens: number
  sum_total_tokens: number
}

/**
 * Tổng hợp token messaging theo từng shop + model trong khoảng thời gian.
 * Nguồn: public.messaging_partner_ai_token_usage (DeepSeek/Gemini của hệ messaging theo partner_id).
 */
export async function fetchMessagingPartnerTokenUsageByShopModelInRange(
  fromIso: string,
  toIso: string
): Promise<MessagingPartnerTokenUsageByShopModelRow[]> {
  if (!isPgConfigured()) return []
  const rows = await pgQuery<{
    partner_id: string
    partner_slug: string | null
    partner_display_name: string | null
    owner_user_id: string | null
    owner_email: string | null
    model: string | null
    call_count: string | number | null
    sum_prompt_tokens: string | number | null
    sum_completion_tokens: string | number | null
    sum_total_tokens: string | number | null
  }>(
    `select
       u.partner_id::text as partner_id,
       mp.slug as partner_slug,
       mp.display_name as partner_display_name,
       mp.owner_user_id::text as owner_user_id,
       nullif(au.email, '') as owner_email,
       u.model as model,
       count(*)::bigint as call_count,
       coalesce(sum(u.prompt_tokens), 0)::bigint as sum_prompt_tokens,
       coalesce(sum(u.completion_tokens), 0)::bigint as sum_completion_tokens,
       coalesce(sum(u.total_tokens), 0)::bigint as sum_total_tokens
     from public.messaging_partner_ai_token_usage u
     join public.messaging_partners mp on mp.id = u.partner_id
     left join auth.users au on au.id = mp.owner_user_id
     where u.created_at >= $1::timestamptz and u.created_at <= $2::timestamptz
     group by
       u.partner_id, mp.slug, mp.display_name, mp.owner_user_id, au.email, u.model
     order by sum_total_tokens desc nulls last, u.partner_id asc`,
    [fromIso, toIso]
  )

  return rows.map((r) => ({
    partner_id: String(r.partner_id),
    partner_slug: String(r.partner_slug ?? '').trim(),
    partner_display_name: String(r.partner_display_name ?? '').trim(),
    owner_user_id: r.owner_user_id ? String(r.owner_user_id) : null,
    owner_email: r.owner_email ? String(r.owner_email) : null,
    model: String(r.model ?? '').trim() || 'unknown',
    call_count: Math.max(0, Math.floor(Number(r.call_count ?? 0))),
    sum_prompt_tokens: Math.max(0, Math.floor(Number(r.sum_prompt_tokens ?? 0))),
    sum_completion_tokens: Math.max(0, Math.floor(Number(r.sum_completion_tokens ?? 0))),
    sum_total_tokens: Math.max(0, Math.floor(Number(r.sum_total_tokens ?? 0))),
  }))
}
