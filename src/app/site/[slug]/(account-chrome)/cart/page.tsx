import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopCartClient } from '@/components/partner-website/shop/partner-site-shop-cart-client'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({ title: 'Cart', description: 'Cart', path: `/site/${slug}/cart`, noIndex: true })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Cart`,
    description: shop.site.partnerDisplayName,
    path: '/cart',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteCartPage({ params }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  // Checkout / đặt cọc / cảm ơn là React (giống 188) — không serve cart.html vỏ trống.

  return (
    <PartnerSiteShopCartClient
      siteSlug={shop.site.siteSlug}
      partnerSlug={shop.partnerSlug}
      shopTitle={shop.site.title}
      locale={shop.site.locale}
      chatPath={shop.site.chatPath}
    />
  )
}
