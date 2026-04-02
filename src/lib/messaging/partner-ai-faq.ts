import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

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

/** Trả về FAQ đầu tiên khớp (theo sort_order). */
export async function findMatchingFaq(db: Db, partnerId: string, customerMessage: string): Promise<FaqRow | null> {
  const text = normalize(customerMessage)
  if (!text) return null
  const { data, error } = await db
    .from('messaging_partner_faq')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error || !data?.length) return null
  for (const row of data) {
    const keys = parseTriggerKeywords(row.trigger_keywords)
    for (const k of keys) {
      if (k && text.includes(k)) return row
    }
  }
  return null
}
