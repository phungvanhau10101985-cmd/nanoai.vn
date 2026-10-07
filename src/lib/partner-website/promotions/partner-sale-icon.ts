import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import type { PartnerSaleCalendarState } from '@/lib/partner-website/promotions/partner-sale-calendar'

export const PARTNER_SALE_ICON_ASPECT = '1:1'
/** Composite of the real favicon plus a date band. No paid image model. */
export const PARTNER_SALE_ICON_CREDIT_COST = 0
export const PARTNER_SALE_ICON_LAYOUT_ID = 'sale-icon-date-band-v1'
export const PARTNER_SALE_ICON_PX = 512

export type PartnerSaleIconSources = {
  faviconUrl: string | null
  pwaIconUrl: string | null
  logoUrl: string | null
}

export type PartnerSaleIconAsset = {
  id: string
  day: number
  month: number
  discountPercent: number
  imageUrl: string | null
  status: 'generating' | 'ready' | 'failed'
  sourceFaviconUrl: string | null
  sourcePwaIconUrl: string | null
}

export function partnerSaleIconDateKey(day: number, month: number): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isPartnerSaleIconSameDayMonth(day: number, month: number): boolean {
  return day === month && day >= 1 && day <= 12
}

export function parsePartnerSaleIconYmd(raw: string | null | undefined): { day: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw || '').trim())
  if (!match) return null
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { day, month }
}

export function partnerShopSaleIconSourceUrls(input: PartnerSaleIconSources): string[] {
  const out: string[] = []
  for (const raw of [input.faviconUrl, input.pwaIconUrl, input.logoUrl]) {
    const value = String(raw || '').trim()
    if (!/^https?:\/\//i.test(value) || out.includes(value)) continue
    out.push(value)
  }
  return out
}

export function shouldUsePartnerSaleIcon(input: {
  auto?: boolean | null
  phase?: PartnerSaleCalendarState['phase'] | null
  saleDate?: string | null
}): boolean {
  if (input.auto === false) return false
  if (input.phase !== 'teaser' && input.phase !== 'active') return false
  const ymd = parsePartnerSaleIconYmd(input.saleDate)
  if (!ymd) return false
  return isPartnerSaleIconSameDayMonth(ymd.day, ymd.month)
}

export function applyPartnerSaleIconToTheme(
  theme: PartnerWebsiteTheme,
  imageUrl: string | null | undefined
): PartnerWebsiteTheme {
  const url = String(imageUrl || '').trim()
  if (!/^https?:\/\//i.test(url)) return theme
  return { ...theme, faviconUrl: url, pwaIconUrl: url }
}

export function partnerSaleIconCacheToken(imageUrl?: string | null): string {
  const url = String(imageUrl || '').trim()
  return url ? `on-${url.slice(-24)}` : 'off'
}

export function partnerSaleIconDateLabel(day: number, month: number): string {
  return `${day}/${month}`
}

export function partnerSaleIconLayoutIsCurrent(prompt: string | null | undefined): boolean {
  return String(prompt || '') === PARTNER_SALE_ICON_LAYOUT_ID
}
