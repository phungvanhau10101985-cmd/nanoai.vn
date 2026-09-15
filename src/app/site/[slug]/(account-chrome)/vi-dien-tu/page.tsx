import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopAccountClient } from '@/components/partner-website/shop/partner-site-shop-account-client'
import { loadSiteVisitorProfileForRequest } from '@/lib/partner-website/shop/partner-site-personalization'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Affiliate',
      description: 'Affiliate',
      path: `/site/${slug}/vi-dien-tu`,
      noIndex: true,
    })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Affiliate`,
    description: shop.site.partnerDisplayName,
    path: '/vi-dien-tu',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

/** 188 `/vi-dien-tu` alias — same affiliate wallet page as `/account/affiliate`. */
export default async function PartnerSiteAffiliateWalletPage({ params }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const partnerSlug = shop.partnerSlug
  if (!partnerSlug.trim()) notFound()
  const initialProfile = await loadSiteVisitorProfileForRequest(shop.partnerId)

  return (
    <PartnerSiteShopAccountClient
      siteSlug={shop.site.siteSlug}
      partnerSlug={partnerSlug}
      shopTitle={shop.site.title}
      locale={shop.site.locale}
      initialTab="affiliate"
      initialProfile={initialProfile}
    />
  )
}
