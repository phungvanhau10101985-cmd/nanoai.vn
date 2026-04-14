import type { Database, Json } from '@/types/database.types'
import { fetchMessagingPartnerFaqsActiveFromPg } from '@/lib/db/messaging-partner-faq-pg'
import { isPgConfigured } from '@/lib/db/pool'
import {
  isPartnerFaqPresetKey,
  presetKeywordBlob,
  presetSortOrder,
  type PartnerFaqPresetKey,
} from '@/lib/messaging/partner-faq-presets'
import type { WebLocale } from '@/lib/i18n/config'
import { resolveFaqAnswerForLocale } from '@/lib/messaging/partner-faq-i18n-deepseek'

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

/** Trả về FAQ đầu tiên khớp (preset mẫu trước, rồi FAQ tuỳ chỉnh). `answer` đã chọn theo locale khách. Chỉ Postgres. */
export async function findMatchingFaq(
  partnerId: string,
  customerMessage: string,
  opts?: { locale?: WebLocale | null }
): Promise<FaqRow | null> {
  const text = normalize(customerMessage)
  if (!text) return null
  if (!isPgConfigured()) return null
  const data = await fetchMessagingPartnerFaqsActiveFromPg(partnerId)
  if (!data?.length) return null
  const rows = sortFaqRowsForMatching(data).filter((r) => r.answer?.trim())
  for (const row of rows) {
    const keys = matchKeysForRow(row)
    for (const k of keys) {
      if (k && text.includes(k)) {
        const resolved = resolveFaqAnswerForLocale(row.answer, row.answer_i18n as Json, opts?.locale ?? null)
        return { ...row, answer: resolved }
      }
    }
  }
  return null
}
