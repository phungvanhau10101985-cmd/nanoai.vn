import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopOrderDetailClient } from '@/components/partner-website/shop/partner-site-shop-order-detail-client'

type Props = {
  params: Promise<{ slug: string; orderId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, orderId } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Order',
      description: 'Order',
      path: `/site/${slug}/orders/${orderId}`,
      noIndex: true,
    })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Order`,
    description: shop.site.partnerDisplayName,
    path: `/orders/${encodeURIComponent(orderId)}`,
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteOrderDetailPage({ params }: Props) {
  const { slug, orderId } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const id = String(orderId ?? '').trim()
  if (!id) notFound()

  return (
    <PartnerSiteShopOrderDetailClient
      siteSlug={shop.site.siteSlug}
      partnerSlug={shop.partnerSlug}
      locale={shop.site.locale}
      orderId={id}
    />
  )
}
