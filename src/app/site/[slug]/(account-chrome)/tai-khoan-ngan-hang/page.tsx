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
      title: 'Bank account',
      description: 'Bank account',
      path: `/site/${slug}/tai-khoan-ngan-hang`,
      noIndex: true,
    })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Bank account`,
    description: shop.site.partnerDisplayName,
    path: '/tai-khoan-ngan-hang',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

/** 188 `/tai-khoan-ngan-hang` alias — same bank page as `/account/affiliate-bank`. */
export default async function PartnerSiteAffiliateBankPage({ params }: Props) {
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
      initialTab="affiliate-bank"
      initialProfile={initialProfile}
    />
  )
}
