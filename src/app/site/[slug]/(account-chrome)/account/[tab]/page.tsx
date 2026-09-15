import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopAccountClient } from '@/components/partner-website/shop/partner-site-shop-account-client'
import {
  loadSiteSavedProductsForRequest,
  loadSiteVisitorProfileForRequest,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { loadSiteOrdersForRequest } from '@/lib/partner-website/shop/load-site-orders-for-request'
import { loadSiteLoyaltyForRequest } from '@/lib/partner-website/shop/load-site-loyalty-for-request'
import {
  isPartnerSiteAccountTab,
  type PartnerSiteAccountTab,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { normalizePartnerSiteLoyaltyTab } from '@/lib/partner-website/shop/partner-site-loyalty'
import { normalizePartnerSiteAffiliateTab } from '@/lib/partner-website/shop/partner-site-affiliate'

type Props = {
  params: Promise<{ slug: string; tab: string }>
  searchParams?: Promise<{ tab?: string; 'pw-device'?: string }>
}

/** Overview lives at `/account` — reject `overview` as a path segment. */
const ROUTE_TABS = new Set<PartnerSiteAccountTab>([
  'cart',
  'orders',
  'wallet',
  'loyalty',
  'affiliate',
  'affiliate-bank',
  'wishlist',
  'recently-viewed',
  'addresses',
  'edit-profile',
  'contact',
  'security',
  'notifications',
  'install-app',
])

function resolveAccountRouteTab(raw: string): PartnerSiteAccountTab | null {
  const normalized = raw.trim().toLowerCase()
  const loyalty = normalizePartnerSiteLoyaltyTab(normalized)
  if (loyalty) return loyalty
  const affiliate = normalizePartnerSiteAffiliateTab(normalized)
  if (affiliate) return affiliate
  if (isPartnerSiteAccountTab(normalized) && ROUTE_TABS.has(normalized)) return normalized
  return null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, tab } = await params
  const normalized = resolveAccountRouteTab(tab)
  if (!normalized) {
    return buildMetadata({
      title: 'Account',
      description: 'Account',
      path: `/site/${slug}/account/${tab}`,
      noIndex: true,
    })
  }
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Account',
      description: 'Account',
      path: `/site/${slug}/account/${normalized}`,
      noIndex: true,
    })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Account`,
    description: shop.site.partnerDisplayName,
    path: `/account/${normalized}`,
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteAccountTabPage({ params, searchParams }: Props) {
  const { slug, tab } = await params
  const normalized = resolveAccountRouteTab(tab)
  if (!normalized) notFound()

  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const partnerSlug = shop.partnerSlug
  if (!partnerSlug.trim()) notFound()

  const sp = (await searchParams) ?? {}
  const ordersFilter = normalized === 'orders' ? sp.tab?.trim() || null : null
  const initialProfile = await loadSiteVisitorProfileForRequest(shop.partnerId)
  const initialOrders =
    normalized === 'orders' ? await loadSiteOrdersForRequest(shop.partnerId) : null
  const initialLoyalty =
    normalized === 'loyalty' ? await loadSiteLoyaltyForRequest(shop.partnerId) : null
  const initialSavedProducts =
    normalized === 'wishlist' || normalized === 'recently-viewed'
      ? await loadSiteSavedProductsForRequest({
          partnerId: shop.partnerId,
          siteSlug: shop.site.siteSlug,
          mode: normalized === 'wishlist' ? 'favorites' : 'recently-viewed',
        })
      : undefined

  return (
    <PartnerSiteShopAccountClient
      siteSlug={shop.site.siteSlug}
      partnerSlug={partnerSlug}
      shopTitle={shop.site.title}
      locale={shop.site.locale}
      initialTab={normalized}
      initialOrdersFilter={ordersFilter}
      initialSavedProducts={initialSavedProducts}
      initialProfile={initialProfile}
      initialOrders={initialOrders}
      initialLoyalty={initialLoyalty}
    />
  )
}
