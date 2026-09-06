import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopOrdersClient } from '@/components/partner-website/shop/partner-site-shop-orders-client'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({ title: 'Orders', description: 'Orders', path: `/site/${slug}/orders`, noIndex: true })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Orders`,
    description: shop.site.partnerDisplayName,
    path: '/orders',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteOrdersPage({ params }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  // Danh sách đơn / thanh toán cọc là React — không serve orders.html vỏ trống.

  return (
    <PartnerSiteShopOrdersClient
      siteSlug={shop.site.siteSlug}
      partnerSlug={shop.partnerSlug}
      locale={shop.site.locale}
      chatPath={shop.site.chatPath}
    />
  )
}
