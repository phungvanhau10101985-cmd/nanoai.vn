export type GuestPurchaseFlow = 'in_chat' | 'external_site'

export function normalizeGuestPurchaseFlow(v: unknown): GuestPurchaseFlow {
  return v === 'external_site' ? 'external_site' : 'in_chat'
}
