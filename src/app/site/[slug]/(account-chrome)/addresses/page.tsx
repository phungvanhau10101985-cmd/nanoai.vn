import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopAddressesClient } from '@/components/partner-website/shop/partner-site-shop-addresses-client'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Addresses',
      description: 'Addresses',
      path: `/site/${slug}/addresses`,
      noIndex: true,
    })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Addresses`,
    description: shop.site.partnerDisplayName,
    path: '/addresses',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

/** Sổ địa chỉ luôn React (CRUD sống) — không đóng băng HTML Sửa nhanh. */
export default async function PartnerSiteAddressesPage({ params }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()

  return (
    <PartnerSiteShopAddressesClient
      siteSlug={shop.site.siteSlug}
      partnerSlug={shop.partnerSlug}
      shopTitle={shop.site.title}
      locale={shop.site.locale}
    />
  )
}
