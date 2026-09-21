import {
  releasePartnerOrderWarehouseStockFromPg,
  restorePartnerOrderWarehouseStockFromPg,
  skipPartnerOrderShipmentTimelineFromPg,
} from '@/lib/db/messaging-partner-order-shipment-pg'
import {
  clawbackPartnerAffiliateForOrderFromPg,
  grantPartnerAffiliateCommissionAfterPaidFromPg,
  transitionPartnerAffiliateCommissionFromPg,
} from '@/lib/db/messaging-partner-affiliate-pg'

export type PartnerOrderLifecycleEvent = 'paid' | 'delivered' | 'cancelled' | 'refunded' | 'returned'
export type PartnerOrderLifecycleEffect =
  | 'affiliate_grant'
  | 'affiliate_confirm'
  | 'affiliate_clawback_with_wallet'
  | 'affiliate_clawback_commission_only'
  | 'timeline_skip'
  | 'stock_reconcile_terminal'

export function partnerOrderLifecycleEffectPlan(event: PartnerOrderLifecycleEvent): PartnerOrderLifecycleEffect[] {
  if (event === 'paid') return ['affiliate_grant']
  if (event === 'delivered') return ['affiliate_grant', 'affiliate_confirm']
  if (event === 'refunded') return ['affiliate_clawback_with_wallet']
  return [
    'timeline_skip',
    'stock_reconcile_terminal',
    event === 'returned' ? 'affiliate_clawback_commission_only' : 'affiliate_clawback_with_wallet',
  ]
}

/**
 * Shared terminal lifecycle entry point.
 * Stock line markers and the per-order affiliate row make every effect replay-safe.
 */
export async function runPartnerOrderLifecycleHook(input: {
  partnerId: string
  orderId: string
  event: PartnerOrderLifecycleEvent
}): Promise<void> {
  for (const effect of partnerOrderLifecycleEffectPlan(input.event)) {
    if (effect === 'affiliate_grant') {
      await grantPartnerAffiliateCommissionAfterPaidFromPg(input)
    } else if (effect === 'affiliate_confirm') {
      await transitionPartnerAffiliateCommissionFromPg({ ...input, state: 'confirmed' })
    } else if (effect === 'affiliate_clawback_with_wallet') {
      await clawbackPartnerAffiliateForOrderFromPg({ ...input, refundWallet: true })
    } else if (effect === 'affiliate_clawback_commission_only') {
      await clawbackPartnerAffiliateForOrderFromPg({ ...input, refundWallet: false })
    } else if (effect === 'timeline_skip') {
      await skipPartnerOrderShipmentTimelineFromPg(input.orderId)
    } else if (effect === 'stock_reconcile_terminal') {
      // Marker predicates make these mutually exclusive per line: an
      // undeducted reservation is released; a deducted line is restored.
      await releasePartnerOrderWarehouseStockFromPg(input)
      await restorePartnerOrderWarehouseStockFromPg(input)
    }
  }
}
