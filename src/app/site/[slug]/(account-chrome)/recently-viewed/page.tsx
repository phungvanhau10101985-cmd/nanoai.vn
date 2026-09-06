import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PartnerSiteShopSavedProductsClient } from '@/components/partner-website/shop/partner-site-shop-saved-products-client'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { loadSiteSavedProductsForRequest } from '@/lib/partner-website/shop/partner-site-personalization'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Recently viewed',
      description: 'Recently viewed',
      path: `/site/${slug}/recently-viewed`,
      noIndex: true,
    })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Recently viewed`,
    description: shop.site.partnerDisplayName,
    path: '/recently-viewed',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteRecentlyViewedPage({ params }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const initialProducts = await loadSiteSavedProductsForRequest({
    partnerId: shop.partnerId,
    siteSlug: shop.site.siteSlug,
    mode: 'recently-viewed',
  })

  return (
    <PartnerSiteShopSavedProductsClient
      siteSlug={shop.site.siteSlug}
      locale={shop.site.locale}
      mode="recently-viewed"
      initialProducts={initialProducts}
    />
  )
}
