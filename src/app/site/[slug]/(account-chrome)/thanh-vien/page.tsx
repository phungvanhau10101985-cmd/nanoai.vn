import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopAccountClient } from '@/components/partner-website/shop/partner-site-shop-account-client'
import { loadSiteVisitorProfileForRequest } from '@/lib/partner-website/shop/partner-site-personalization'
import { loadSiteLoyaltyForRequest } from '@/lib/partner-website/shop/load-site-loyalty-for-request'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Membership',
      description: 'Membership',
      path: `/site/${slug}/thanh-vien`,
      noIndex: true,
    })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Membership`,
    description: shop.site.partnerDisplayName,
    path: '/thanh-vien',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

/** 188 `/thanh-vien` alias — same membership page as `/account/loyalty`. */
export default async function PartnerSiteMembershipPage({ params }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const partnerSlug = shop.partnerSlug
  if (!partnerSlug.trim()) notFound()
  const [initialProfile, initialLoyalty] = await Promise.all([
    loadSiteVisitorProfileForRequest(shop.partnerId),
    loadSiteLoyaltyForRequest(shop.partnerId),
  ])

  return (
    <PartnerSiteShopAccountClient
      siteSlug={shop.site.siteSlug}
      partnerSlug={partnerSlug}
      shopTitle={shop.site.title}
      locale={shop.site.locale}
      initialTab="loyalty"
      initialProfile={initialProfile}
      initialLoyalty={initialLoyalty}
    />
  )
}
