import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import {
  createPartnerAiRouteDecision,
  legacyWidgetIntentToRouteIntent,
  parsePartnerAiCtaStrategy,
  parsePartnerAiRouteIntent,
  parsePartnerAiSalesStage,
  parsePartnerAiWidgetIntent,
  type PartnerAiRouteDecision,
  type PartnerAiRouteIntent,
} from '@/lib/messaging/partner-ai-intent-router'

function mapDecision(raw: string): PartnerAiRouteIntent | null {
  const route = parsePartnerAiRouteIntent(raw)
  if (route) return route
  const legacy = parsePartnerAiWidgetIntent(raw)
  return legacy ? legacyWidgetIntentToRouteIntent(legacy) : null
}

export async function fetchWidgetIntentCachePg(lookupHash: string): Promise<PartnerAiRouteDecision | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{
    decision: string
    sales_stage: string | null
    cta_strategy: string | null
    category: string | null
    reason: string | null
  }>(
    `select decision, sales_stage, cta_strategy, category, reason
       from public.messaging_partner_widget_intent_cache
      where lookup_hash = $1`,
    [lookupHash]
  )
  if (!row?.decision) return null
  const intent = mapDecision(row.decision)
  if (!intent) return null
  return createPartnerAiRouteDecision(intent, {
    confidence: 0.9,
    source: 'ai_classifier',
    salesStage: parsePartnerAiSalesStage(row.sales_stage),
    ctaStrategy: parsePartnerAiCtaStrategy(row.cta_strategy),
    category: row.category,
    reason: row.reason ?? 'cache',
  })
}

export async function upsertWidgetIntentCachePg(input: {
  lookupHash: string
  partnerId: string
  decision: PartnerAiRouteIntent
  classifierVersion: string
  customerTextNorm: string
  shopContextNorm: string
  salesStage?: string | null
  ctaStrategy?: string | null
  category?: string | null
  reason?: string | null
}): Promise<void> {
  if (!isPgConfigured()) return
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.messaging_partner_widget_intent_cache
         (lookup_hash, partner_id, decision, classifier_version, customer_text_norm, shop_context_norm,
          sales_stage, cta_strategy, category, reason)
       values ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (lookup_hash) do nothing`,
      [
        input.lookupHash,
        input.partnerId,
        input.decision,
        input.classifierVersion,
        input.customerTextNorm,
        input.shopContextNorm,
        input.salesStage ?? null,
        input.ctaStrategy ?? null,
        input.category ?? null,
        input.reason ?? null,
      ]
    )
  } catch (e) {
    console.warn('[messaging-partner-widget-intent-cache-pg] upsert failed', e)
  }
}
