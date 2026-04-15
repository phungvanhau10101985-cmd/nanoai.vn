import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import type { PartnerAiWidgetIntent } from '@/lib/messaging/partner-ai-unclear-intent'

function mapDecision(raw: string): PartnerAiWidgetIntent | null {
  const d = raw.trim()
  if (d === 'context_reply' || d === 'clarify' || d === 'product_search') return d
  return null
}

export async function fetchWidgetIntentCachePg(lookupHash: string): Promise<PartnerAiWidgetIntent | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ decision: string }>(
    `select decision
       from public.messaging_partner_widget_intent_cache
      where lookup_hash = $1`,
    [lookupHash]
  )
  if (!row?.decision) return null
  return mapDecision(row.decision)
}

export async function upsertWidgetIntentCachePg(input: {
  lookupHash: string
  partnerId: string
  decision: PartnerAiWidgetIntent
  classifierVersion: string
  customerTextNorm: string
  shopContextNorm: string
}): Promise<void> {
  if (!isPgConfigured()) return
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.messaging_partner_widget_intent_cache
         (lookup_hash, partner_id, decision, classifier_version, customer_text_norm, shop_context_norm)
       values ($1, $2::uuid, $3, $4, $5, $6)
       on conflict (lookup_hash) do nothing`,
      [
        input.lookupHash,
        input.partnerId,
        input.decision,
        input.classifierVersion,
        input.customerTextNorm,
        input.shopContextNorm,
      ]
    )
  } catch (e) {
    console.warn('[messaging-partner-widget-intent-cache-pg] upsert failed', e)
  }
}
