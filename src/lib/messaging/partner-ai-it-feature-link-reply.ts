import { partnerSiteItFeatureHref } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  partnerAiIntentAllowsProductContext,
  type PartnerAiRouteIntent,
} from '@/lib/messaging/partner-ai-intent-router'

/** Một tin chat ngành CNTT không liệt kê cả catalog. */
export const IT_FEATURE_LINK_REPLY_MAX = 5

export type ItFeatureInventoryHit = {
  name?: string | null
  product_url?: string | null
}

export type ItFeatureLinkItem = {
  name: string
  url: string
}

export type ItFeatureLinkCopy = {
  /** Có `{name}`. */
  oneLead: string
  manyLead: string
  clickHint: string
}

/**
 * URL tính năng để dán vào tin chat.
 * Đường dẫn tương đối (`/thu-do-online/1-nguoi`) gắn origin nền tảng.
 * URL tuyệt đối trong kho giữ nguyên. PDP, `/site/`, nguồn TQ, `shop.local` bị loại.
 */
export function absoluteItFeatureLink(
  productUrl: string | null | undefined,
  origin: string
): string | null {
  const href = partnerSiteItFeatureHref(productUrl)
  if (!href) return null
  if (/^https?:\/\//i.test(href)) return href
  if (!href.startsWith('/')) return null
  const base = String(origin || '').trim().replace(/\/$/, '')
  if (!base) return null
  return `${base}${href}`
}

export function itFeatureLinksFromRows(
  rows: ItFeatureInventoryHit[],
  origin: string,
  max = IT_FEATURE_LINK_REPLY_MAX
): ItFeatureLinkItem[] {
  const out: ItFeatureLinkItem[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const url = absoluteItFeatureLink(row.product_url, origin)
    if (!url) continue
    const key = url.replace(/\/+$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const name = String(row.name ?? '').trim() || url
    out.push({ name, url })
    if (out.length >= max) break
  }
  return out
}

export function buildItFeatureLinkReply(links: ItFeatureLinkItem[], copy: ItFeatureLinkCopy): string {
  if (links.length === 0) return ''
  if (links.length === 1) {
    const lead = copy.oneLead.replaceAll('{name}', links[0].name)
    return `${lead}\n${links[0].url}\n\n${copy.clickHint}`.trim()
  }
  const lines = links.map((link) => `${link.name}\n${link.url}`).join('\n\n')
  return `${copy.manyLead}\n\n${lines}\n\n${copy.clickHint}`.trim()
}

/**
 * Chọn dòng kho để gửi link. Chính sách / làm rõ / tạm dừng không vào đây.
 * Một tính năng đang neo → một link. Tìm mới hoặc mẫu khác → các dòng đã khớp.
 */
export function pickItFeatureLinkSourceRows<T extends ItFeatureInventoryHit>(input: {
  intent: PartnerAiRouteIntent | null
  anchored: T | null
  explicitSku: T | null
  lastConsulted: T | null
  useLastConsulted: boolean
  searchRows: T[] | null
  similarRows: T[] | null
}): T[] {
  if (!partnerAiIntentAllowsProductContext(input.intent)) return []
  if (input.intent === 'new_product_search') return input.searchRows ?? []
  if (input.intent === 'similar_alternatives') return input.similarRows ?? []
  const one = input.anchored ?? input.explicitSku ?? (input.useLastConsulted ? input.lastConsulted : null)
  return one ? [one] : []
}
