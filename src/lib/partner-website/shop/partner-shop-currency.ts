/** S0.10 — display/tracking currency codes (no FX conversion). */
export const PARTNER_SHOP_CURRENCIES = ['VND', 'USD', 'THB', 'JPY', 'KRW', 'CNY'] as const

export type PartnerShopCurrency = (typeof PARTNER_SHOP_CURRENCIES)[number]

export function normalizePartnerShopCurrency(raw: unknown): PartnerShopCurrency {
  const c = String(raw ?? '')
    .trim()
    .toUpperCase()
  return (PARTNER_SHOP_CURRENCIES as readonly string[]).includes(c) ? (c as PartnerShopCurrency) : 'VND'
}
