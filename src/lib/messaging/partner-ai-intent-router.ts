export type PartnerAiRouteIntent =
  | 'card_consult_isolated'
  | 'explicit_sku_consult'
  | 'follow_up_current_product'
  | 'new_product_search'
  | 'similar_alternatives'
  | 'purchase_or_order'
  | 'policy_or_order_support'
  | 'clarify'
  | 'pause_or_close'

export type PartnerAiRouteSource = 'hard_rule' | 'ai_classifier' | 'fallback'

export type PartnerAiRouteDecision = {
  intent: PartnerAiRouteIntent
  confidence: number
  category?: string | null
  reason?: string | null
  source: PartnerAiRouteSource
}

/** Legacy 3-way widget classifier labels kept for old raw_payload/cache compatibility. */
export type PartnerAiWidgetIntent = 'context_reply' | 'clarify' | 'product_search'

const ROUTE_INTENTS: readonly PartnerAiRouteIntent[] = [
  'card_consult_isolated',
  'explicit_sku_consult',
  'follow_up_current_product',
  'new_product_search',
  'similar_alternatives',
  'purchase_or_order',
  'policy_or_order_support',
  'clarify',
  'pause_or_close',
] as const

export function parsePartnerAiRouteIntent(raw: unknown): PartnerAiRouteIntent | null {
  const v = String(raw ?? '').trim()
  return (ROUTE_INTENTS as readonly string[]).includes(v) ? (v as PartnerAiRouteIntent) : null
}

export function parsePartnerAiWidgetIntent(raw: unknown): PartnerAiWidgetIntent | null {
  const v = String(raw ?? '').trim()
  if (v === 'context_reply' || v === 'clarify' || v === 'product_search') return v
  return null
}

export function legacyWidgetIntentToRouteIntent(intent: PartnerAiWidgetIntent): PartnerAiRouteIntent {
  if (intent === 'context_reply') return 'follow_up_current_product'
  if (intent === 'product_search') return 'new_product_search'
  return 'clarify'
}

export function routeIntentToLegacyWidgetIntent(intent: PartnerAiRouteIntent): PartnerAiWidgetIntent {
  if (intent === 'clarify' || intent === 'pause_or_close') return 'clarify'
  if (
    intent === 'follow_up_current_product' ||
    intent === 'explicit_sku_consult' ||
    intent === 'policy_or_order_support' ||
    intent === 'purchase_or_order'
  ) {
    return 'context_reply'
  }
  return 'product_search'
}

export function createPartnerAiRouteDecision(
  intent: PartnerAiRouteIntent,
  input?: {
    confidence?: number
    category?: string | null
    reason?: string | null
    source?: PartnerAiRouteSource
  }
): PartnerAiRouteDecision {
  return {
    intent,
    confidence: Math.max(0, Math.min(1, input?.confidence ?? 1)),
    category: input?.category ?? null,
    reason: input?.reason ?? null,
    source: input?.source ?? 'hard_rule',
  }
}

export function parsePartnerAiRouteDecision(raw: unknown): PartnerAiRouteDecision | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const nested = o.partner_ai_route_decision
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>
    const intent = parsePartnerAiRouteIntent(n.intent)
    if (intent) {
      return createPartnerAiRouteDecision(intent, {
        confidence: typeof n.confidence === 'number' ? n.confidence : Number(n.confidence ?? 1),
        category: typeof n.category === 'string' ? n.category : null,
        reason: typeof n.reason === 'string' ? n.reason : null,
        source:
          n.source === 'hard_rule' || n.source === 'ai_classifier' || n.source === 'fallback'
            ? n.source
            : 'fallback',
      })
    }
  }

  const directIntent = parsePartnerAiRouteIntent(o.partner_ai_route_intent)
  if (directIntent) return createPartnerAiRouteDecision(directIntent, { source: 'fallback' })

  const legacy = parsePartnerAiWidgetIntent(o.partner_ai_widget_intent)
  if (legacy) {
    return createPartnerAiRouteDecision(legacyWidgetIntentToRouteIntent(legacy), {
      source: 'fallback',
      reason: `legacy:${legacy}`,
    })
  }

  return null
}

export function partnerAiRouteDecisionToPayload(
  decision: PartnerAiRouteDecision
): Record<string, unknown> {
  return {
    partner_ai_route_intent: decision.intent,
    partner_ai_route_decision: {
      intent: decision.intent,
      confidence: decision.confidence,
      category: decision.category ?? null,
      reason: decision.reason ?? null,
      source: decision.source,
    },
    partner_ai_widget_intent: routeIntentToLegacyWidgetIntent(decision.intent),
  }
}

