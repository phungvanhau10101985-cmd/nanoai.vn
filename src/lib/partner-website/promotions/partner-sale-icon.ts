import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import type { PartnerSaleCalendarState } from '@/lib/partner-website/promotions/partner-sale-calendar'

export const PARTNER_SALE_ICON_ASPECT = '1:1'
export const PARTNER_SALE_ICON_CREDIT_COST = 1.5

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

export function buildPartnerSaleIconPrompt(input: {
  shopName?: string | null
  day: number
  month: number
  discountPercent: number
  primaryColor?: string | null
  hasReference: boolean
}): string {
  const shop = String(input.shopName || 'Shop').trim() || 'Shop'
  const label = `${input.day}/${input.month}`
  const pct = Math.max(0, Math.min(100, Math.round(Number(input.discountPercent) || 0)))
  const color = String(input.primaryColor || '').trim()
  const parts = [
    `Square 1:1 app icon and favicon for "${shop}" same-day-same-month sale ${label}`,
    pct > 0 ? `(${pct}% off).` : '.',
    'Fill the entire square frame. High-contrast shop mark, readable at 16px, 32px, and 180px home-screen size.',
    `Add one compact SALE or ${label} badge — no paragraphs, no extra slogans, no photo collage.`,
    'Flat or simple icon style. Not a 21:9 banner. Not a circular stamp unless the reference already is square-cropped.',
  ]
  if (color) parts.push(`Keep brand hue close to ${color}.`)
  if (input.hasReference) {
    parts.push(
      'Attached references: the current browser favicon and the mobile web-app avatar. Keep the same mark, colors, and composition; only add the sale badge. Do not invent a new logo.'
    )
  }
  return parts.join(' ')
}
