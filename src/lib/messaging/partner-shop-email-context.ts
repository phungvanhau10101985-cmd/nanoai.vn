import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { fetchPartnerWebsiteConfiguredSiteOriginPg } from '@/lib/db/messaging-partner-custom-domains-pg'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { resolvePartnerWebsitePublicUrl } from '@/lib/partner-website/resolve-partner-website-public-url'
import { partnerWebsitePublicPath } from '@/lib/partner-website/partner-website-slug'
import { resolveShopThemeColors } from '@/lib/partner-website/template/partner-website-theme-tokens'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'

export type PartnerShopEmailContext = {
  partnerId: string
  shopDisplayName: string
  siteSlug: string
  locale: WebLocale
  shopUrl: string
  cartUrl: string
  walletUrl: string
  buyButtonColor: string
}

function joinShopPath(shopUrl: string, path: string): string {
  const base = shopUrl.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export async function resolvePartnerShopEmailContext(partnerId: string): Promise<PartnerShopEmailContext> {
  const partners = await fetchMessagingPartnersByIdsFromPg([partnerId])
  const shopDisplayName = partners?.[0]?.display_name?.trim() || 'Shop'
  const website = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  const siteSlug = website?.siteSlug?.trim() || ''
  const locale = normalizeWebLocale(website?.locale) ?? 'vi'
  const theme = resolveShopThemeColors(website?.theme ?? DEFAULT_PARTNER_WEBSITE_THEME)
  const origin = getPublicAppUrlForServer().replace(/\/$/, '')

  let shopUrl = origin
  if (siteSlug) {
    const customOrigin = await fetchPartnerWebsiteConfiguredSiteOriginPg(partnerId)
    if (customOrigin) {
      shopUrl = customOrigin.replace(/\/$/, '')
    } else {
      const publicUrl = await resolvePartnerWebsitePublicUrl({
        partnerId,
        siteSlug,
        isPublished: Boolean(website?.isPublished),
      })
      shopUrl = (publicUrl || `${origin}${partnerWebsitePublicPath(siteSlug)}`).replace(/\/$/, '')
    }
  }

  return {
    partnerId,
    shopDisplayName,
    siteSlug,
    locale,
    shopUrl,
    cartUrl: joinShopPath(shopUrl, '/cart'),
    walletUrl: joinShopPath(shopUrl, '/account/wallet'),
    buyButtonColor: theme.buyButtonColor || '#111827',
  }
}

export function formatPromoVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(amount || 0)))
}

export function escapePromoHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
