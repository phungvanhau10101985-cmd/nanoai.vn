import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

function embedCreatedAtRangeSql(alias: string): string {
  return `and ${alias}.created_at >= $2::timestamptz
        and ($3::timestamptz is null or ${alias}.created_at < $3::timestamptz)`
}

export type PartnerTextEmbedSource = 'inventory_sync' | 'customer_query'

export type PartnerTextEmbedUsageSummaryRow = {
  source: PartnerTextEmbedSource
  call_count: number
  sum_prompt_tokens: number
  sum_total_tokens: number
}

export type PartnerTextEmbedUsageDetailRow = {
  id: string
  created_at: string
  source: PartnerTextEmbedSource
  model: string
  prompt_tokens: number
  total_tokens: number
  inventory_id: string | null
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

export async function insertMessagingPartnerTextEmbedUsageFromPg(params: {
  partnerId: string
  source: PartnerTextEmbedSource
  model: string
  promptTokens: number
  totalTokens: number
  inventoryId?: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pt = Math.max(0, Math.floor(params.promptTokens))
  const tt = Math.max(0, Math.floor(params.totalTokens))
  if (pt <= 0 && tt <= 0) return false
  try {
    await pgQuery(
      `insert into public.messaging_partner_text_embed_usage (
         partner_id, source, model, prompt_tokens, total_tokens, inventory_id
       ) values ($1::uuid, $2, $3, $4, $5, $6::uuid)`,
      [
        params.partnerId,
        params.source,
        params.model,
        Math.max(1, pt || tt || 1),
        Math.max(1, tt || pt || 1),
        params.inventoryId?.trim() ? params.inventoryId.trim() : null,
      ]
    )
    return true
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code || '') : ''
    if (code === '42P01') return false
    console.warn('[insertMessagingPartnerTextEmbedUsageFromPg]', e)
    return false
  }
}

export async function fetchMessagingPartnerTextEmbedStatsBySourceFromPg(
  partnerId: string,
  sinceIso: string,
  untilIsoExclusive?: string | null
): Promise<PartnerTextEmbedUsageSummaryRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      source: string
      call_count: string | number | null
      sum_prompt_tokens: string | number | null
      sum_total_tokens: string | number | null
    }>(
      `select
        u.source,
        count(*)::bigint as call_count,
        coalesce(sum(u.prompt_tokens), 0)::bigint as sum_prompt_tokens,
        coalesce(sum(u.total_tokens), 0)::bigint as sum_total_tokens
      from public.messaging_partner_text_embed_usage u
      where u.partner_id = $1::uuid
        ${embedCreatedAtRangeSql('u')}
      group by u.source
      order by u.source asc`,
      [partnerId, sinceIso, untilIsoExclusive ?? null]
    )
    return rows.map((r) => ({
      source: (r.source === 'customer_query' ? 'customer_query' : 'inventory_sync') as PartnerTextEmbedSource,
      call_count: Math.max(0, Math.floor(Number(r.call_count ?? 0))),
      sum_prompt_tokens: Math.max(0, Math.floor(Number(r.sum_prompt_tokens ?? 0))),
      sum_total_tokens: Math.max(0, Math.floor(Number(r.sum_total_tokens ?? 0))),
    }))
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code || '') : ''
    if (code === '42P01') return []
    console.warn('[fetchMessagingPartnerTextEmbedStatsBySourceFromPg]', e)
    return null
  }
}

export async function fetchMessagingPartnerTextEmbedDetailsFromPg(
  partnerId: string,
  sinceIso: string,
  limit: number,
  untilIsoExclusive?: string | null
): Promise<PartnerTextEmbedUsageDetailRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.min(200, Math.max(1, Math.floor(limit)))
  try {
    const rows = await pgQuery<{
      id: string
      source: string
      model: string | null
      prompt_tokens: string | number | null
      total_tokens: string | number | null
      inventory_id: string | null
      created_at: unknown
    }>(
      `select u.id::text, u.source, u.model, u.prompt_tokens, u.total_tokens, u.inventory_id::text, u.created_at
       from public.messaging_partner_text_embed_usage u
       where u.partner_id = $1::uuid
         ${embedCreatedAtRangeSql('u')}
       order by u.created_at desc
       limit $4`,
      [partnerId, sinceIso, untilIsoExclusive ?? null, lim]
    )
    return rows.map((r) => ({
      id: r.id,
      created_at: toIso(r.created_at),
      source: (r.source === 'customer_query' ? 'customer_query' : 'inventory_sync') as PartnerTextEmbedSource,
      model: String(r.model ?? ''),
      prompt_tokens: Math.max(0, Math.floor(Number(r.prompt_tokens ?? 0))),
      total_tokens: Math.max(0, Math.floor(Number(r.total_tokens ?? 0))),
      inventory_id: r.inventory_id?.trim() ? r.inventory_id.trim() : null,
    }))
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code || '') : ''
    if (code === '42P01') return []
    console.warn('[fetchMessagingPartnerTextEmbedDetailsFromPg]', e)
    return null
  }
}
