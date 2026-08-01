import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'

export type SiteCartLine = {
  id: string
  card: PartnerAiProductCard
  quantity: number
  color: string
  size: string
  note: string
  variantLineImages?: string[]
}

export function cartLineMergeKey(card: PartnerAiProductCard, color: string, size: string): string {
  const pu = (card.product_url ?? '').trim().toLowerCase()
  return `${pu}|${color.trim().toLowerCase()}|${size.trim().toLowerCase()}`
}

export function mergeSiteCartLine(items: SiteCartLine[], line: SiteCartLine): SiteCartLine[] {
  const key = cartLineMergeKey(line.card, line.color, line.size)
  const idx = items.findIndex((x) => cartLineMergeKey(x.card, x.color, x.size) === key)
  const next = [...items]
  if (idx >= 0) {
    next[idx] = {
      ...next[idx],
      quantity: Math.min(99, next[idx].quantity + line.quantity),
      note: line.note || next[idx].note,
      variantLineImages: line.variantLineImages ?? next[idx].variantLineImages,
    }
  } else {
    next.push(line)
  }
  return next
}

export function parseVndFromPriceHint(priceHint: string | undefined): number {
  if (!priceHint) return 0
  const digits = priceHint.replace(/[^\d]/g, '')
  const n = Number(digits)
  return Number.isFinite(n) ? n : 0
}

export function formatVnd(amount: number): string {
  if (amount <= 0) return '—'
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`
}
