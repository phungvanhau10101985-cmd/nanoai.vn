import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { findReadyPartnerSaleIconFromPg } from '@/lib/db/messaging-partner-sale-icon-pg'
import { resolvePartnerSaleCalendarState } from '@/lib/partner-website/promotions/partner-sale-calendar'
import {
  applyPartnerSaleIconToTheme,
  parsePartnerSaleIconYmd,
  partnerSaleIconCacheToken,
  shouldUsePartnerSaleIcon,
} from '@/lib/partner-website/promotions/partner-sale-icon'
import { partnerShopFaviconCacheToken } from '@/lib/partner-website/shop/inject-partner-shop-favicon'
import { partnerShopBrandIconUrls } from '@/lib/partner-website/shop/partner-site-pwa-icon'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'

export function partnerShopLiveIconBust(
  theme: PartnerWebsiteTheme,
  logoUrl?: string | null
): string {
  return partnerShopFaviconCacheToken(theme.faviconUrl || theme.pwaIconUrl, logoUrl || theme.logoUrl)
}

export async function loadPartnerShopLiveBrandTheme(input: {
  partnerId: string
  theme: PartnerWebsiteTheme
}): Promise<{ theme: PartnerWebsiteTheme; saleIconUrl: string | null; cacheToken: string }> {
  const config = await fetchPartnerSaleCalendarConfigFromPg(input.partnerId).catch(() => null)
  if (!config) {
    return { theme: input.theme, saleIconUrl: null, cacheToken: 'off' }
  }
  const state = resolvePartnerSaleCalendarState({ settings: config })
  if (
    !shouldUsePartnerSaleIcon({
      auto: config.saleIconAuto,
      phase: state.phase,
      saleDate: state.saleDate,
    })
  ) {
    return { theme: input.theme, saleIconUrl: null, cacheToken: 'off' }
  }
  const ymd = parsePartnerSaleIconYmd(state.saleDate)
  if (!ymd) return { theme: input.theme, saleIconUrl: null, cacheToken: 'off' }
  const asset = await findReadyPartnerSaleIconFromPg({
    partnerId: input.partnerId,
    day: ymd.day,
    month: ymd.month,
  }).catch(() => null)
  const url = asset?.imageUrl || null
  if (!url) return { theme: input.theme, saleIconUrl: null, cacheToken: 'off' }
  return {
    theme: applyPartnerSaleIconToTheme(input.theme, url),
    saleIconUrl: url,
    cacheToken: partnerSaleIconCacheToken(url),
  }
}

export async function loadPartnerShopLiveBrandIconUrls(input: {
  partnerId: string
  theme: PartnerWebsiteTheme
  logoUrl?: string | null
}): Promise<string[]> {
  const live = await loadPartnerShopLiveBrandTheme({ partnerId: input.partnerId, theme: input.theme })
  return partnerShopBrandIconUrls({
    pwaIconUrl: live.theme.pwaIconUrl,
    faviconUrl: live.theme.faviconUrl,
    logoUrl: input.logoUrl,
  })
}
