import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PartnerSiteShopSavedProductsClient } from '@/components/partner-website/shop/partner-site-shop-saved-products-client'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Wishlist',
      description: 'Wishlist',
      path: `/site/${slug}/wishlist`,
      noIndex: true,
    })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Wishlist`,
    description: shop.site.partnerDisplayName,
    path: '/wishlist',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteWishlistPage({ params }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()

  return (
    <PartnerSiteShopSavedProductsClient
      siteSlug={shop.site.siteSlug}
      locale={shop.site.locale}
      mode="favorites"
    />
  )
}
