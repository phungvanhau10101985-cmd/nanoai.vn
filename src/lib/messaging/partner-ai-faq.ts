import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import {
  isPartnerFaqPresetKey,
  presetKeywordBlob,
  presetSortOrder,
  type PartnerFaqPresetKey,
} from '@/lib/messaging/partner-faq-presets'

type Db = SupabaseClient<Database>

export type FaqRow = Database['public']['Tables']['messaging_partner_faq']['Row']

function normalize(s: string) {
  return s.trim().toLowerCase()
}

export function parseTriggerKeywords(raw: string): string[] {
  const parts = raw.split(/[\n,，;；]+/)
  const out: string[] = []
  for (const p of parts) {
    const t = normalize(p)
    if (t.length >= 2) out.push(t)
  }
  return out
}

function sortFaqRowsForMatching(rows: FaqRow[]): FaqRow[] {
  const presetRank = (k: string | null): number => {
    if (!k || !isPartnerFaqPresetKey(k)) return 10_000
    return presetSortOrder(k as PartnerFaqPresetKey)
  }
  return [...rows].sort((a, b) => {
    const ra = presetRank(a.preset_key)
    const rb = presetRank(b.preset_key)
    if (ra !== rb) return ra - rb
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
}

function matchKeysForRow(row: FaqRow): string[] {
  if (row.preset_key && isPartnerFaqPresetKey(row.preset_key)) {
    return parseTriggerKeywords(presetKeywordBlob(row.preset_key))
  }
  return parseTriggerKeywords(row.trigger_keywords)
}

/** Trả về FAQ đầu tiên khớp (preset mẫu trước, rồi FAQ tuỳ chỉnh). */
export async function findMatchingFaq(db: Db, partnerId: string, customerMessage: string): Promise<FaqRow | null> {
  const text = normalize(customerMessage)
  if (!text) return null
  const { data, error } = await db
    .from('messaging_partner_faq')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('is_active', true)
  if (error || !data?.length) return null
  const rows = sortFaqRowsForMatching(data).filter((r) => r.answer?.trim())
  for (const row of rows) {
    const keys = matchKeysForRow(row)
    for (const k of keys) {
      if (k && text.includes(k)) return row
    }
  }
  return null
}
