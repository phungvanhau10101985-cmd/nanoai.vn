import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopAccountClient } from '@/components/partner-website/shop/partner-site-shop-account-client'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug).catch(() => null)
  if (!shop) {
    return buildMetadata({ title: 'Account', description: 'Account', path: `/site/${slug}/account`, noIndex: true })
  }
  const site = shop.site
  return buildPartnerSiteMetadata({
    siteSlug: site.siteSlug,
    siteName: site.title,
    title: `${site.title} — Account`,
    description: site.partnerDisplayName,
    path: '/account',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

/** Account always uses React auth shell — never frozen visual HTML (login form must work). */
export default async function PartnerSiteAccountPage({ params }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const partnerSlug = shop.partnerSlug
  if (!partnerSlug.trim()) notFound()

  return (
    <PartnerSiteShopAccountClient
      siteSlug={shop.site.siteSlug}
      partnerSlug={partnerSlug}
      shopTitle={shop.site.title}
      locale={shop.site.locale}
      initialTab="overview"
    />
  )
}
