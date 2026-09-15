import type {
  PartnerCustomerLoyaltyStatus,
  PartnerLoyaltyTierRow,
} from '@/lib/db/messaging-partner-loyalty-pg'
import type { PartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'

export type PartnerSiteLoyaltyTierView = {
  code: string
  name: string
  minSpend: number
  discountPercent: number
  sortOrder: number
  rank: number
  status: 'current' | 'reached' | 'locked'
}

export type PartnerSiteLoyaltyStatusView = {
  enabled: boolean
  spendWindowDays: number
  totalSpent: number
  maxTotalDiscountPercent: number
  current: PartnerSiteLoyaltyTierView | null
  next: PartnerSiteLoyaltyTierView | null
  amountToNextTier: number
  progressPercent: number
  tiers: PartnerSiteLoyaltyTierView[]
}

export function formatLoyaltyMoney(amount: number): string {
  const n = Math.max(0, Math.round(Number(amount) || 0))
  return `${new Intl.NumberFormat('vi-VN').format(n)}đ`
}

export function formatLoyaltyPercent(value: number): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '0'
  const rounded = Math.round(n * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

export function fillLoyaltyCopy(template: string, vars: Record<string, string | number>): string {
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) =>
    vars[key] == null ? '' : String(vars[key])
  )
}

export function loyaltyRankHint(
  t: Pick<PartnerSiteShopCopy, 'loyaltyRank0' | 'loyaltyRank1' | 'loyaltyRank2' | 'loyaltyRank3' | 'loyaltyRank4'>,
  rank: number
): string {
  const hints = [t.loyaltyRank0, t.loyaltyRank1, t.loyaltyRank2, t.loyaltyRank3, t.loyaltyRank4]
  return hints[rank] ?? ''
}

export function loyaltyWindowLabel(
  t: Pick<PartnerSiteShopCopy, 'loyaltySpendWindowMonths' | 'loyaltySpendWindowDays'>,
  days: number
): string {
  if (days % 30 === 0 && days >= 30) {
    return fillLoyaltyCopy(t.loyaltySpendWindowMonths, { n: days / 30 })
  }
  return fillLoyaltyCopy(t.loyaltySpendWindowDays, { n: days })
}

/** Progress from the current tier floor to the next tier — not from zero. */
export function loyaltyProgressPercent(input: {
  totalSpent: number
  currentMin: number
  nextMin: number | null
}): number {
  const spent = Math.max(0, Number(input.totalSpent) || 0)
  const currentMin = Math.max(0, Number(input.currentMin) || 0)
  const nextMin = input.nextMin == null ? null : Math.max(0, Number(input.nextMin) || 0)
  if (nextMin == null || nextMin <= currentMin) return 100
  const span = nextMin - currentMin
  const done = spent - currentMin
  return Math.max(0, Math.min(100, Math.round((done / span) * 1000) / 10))
}

function mapTier(row: PartnerLoyaltyTierRow, rank: number): Omit<PartnerSiteLoyaltyTierView, 'status'> {
  return {
    code: row.tier_code,
    name: row.tier_name || row.tier_code,
    minSpend: Math.max(0, Math.round(row.min_spend_6_months || 0)),
    discountPercent: Math.max(0, row.discount_percent || 0),
    sortOrder: row.sort_order,
    rank,
  }
}

export function buildPartnerSiteLoyaltyView(input: {
  status: PartnerCustomerLoyaltyStatus
  tiers: PartnerLoyaltyTierRow[]
}): PartnerSiteLoyaltyStatusView {
  const active = [...input.tiers]
    .filter((t) => t.is_active)
    .sort((a, b) => a.min_spend_6_months - b.min_spend_6_months || a.sort_order - b.sort_order)
  const enabled = input.status.enabled === true
  const totalSpent = enabled ? Math.max(0, Math.round(input.status.totalSpent || 0)) : 0
  const currentCode = enabled ? (input.status.tier?.tier_code ?? '') : ''
  const nextCode = enabled ? (input.status.nextTier?.tier_code ?? '') : ''
  const currentIndex = currentCode ? active.findIndex((t) => t.tier_code === currentCode) : -1
  const tiers: PartnerSiteLoyaltyTierView[] = active.map((row, rank) => {
    const base = mapTier(row, rank)
    let status: PartnerSiteLoyaltyTierView['status'] = 'locked'
    if (enabled && currentCode && row.tier_code === currentCode) status = 'current'
    else if (enabled && (currentIndex >= 0 ? rank < currentIndex : totalSpent >= row.min_spend_6_months)) {
      status = 'reached'
    }
    return { ...base, status }
  })
  const current = tiers.find((t) => t.status === 'current') ?? null
  const next = nextCode ? (tiers.find((t) => t.code === nextCode) ?? null) : null
  return {
    enabled,
    spendWindowDays: Math.max(30, Math.min(730, Math.floor(input.status.spendWindowDays || 180))),
    totalSpent,
    maxTotalDiscountPercent: Math.max(0, input.status.maxTotalDiscountPercent || 0),
    current,
    next,
    amountToNextTier: enabled ? Math.max(0, Math.round(input.status.amountToNextTier || 0)) : 0,
    progressPercent: loyaltyProgressPercent({
      totalSpent,
      currentMin: current?.minSpend ?? 0,
      nextMin: next?.minSpend ?? null,
    }),
    tiers,
  }
}

export function normalizePartnerSiteLoyaltyTab(tab: string): 'loyalty' | null {
  const n = tab.trim().toLowerCase()
  if (n === 'loyalty' || n === 'thanh-vien' || n === 'membership') return 'loyalty'
  return null
}
