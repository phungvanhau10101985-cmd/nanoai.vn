import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopLoginClient } from '@/components/partner-website/shop/partner-site-shop-login-client'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug).catch(() => null)
  if (!shop) {
    return buildMetadata({ title: 'Login', description: 'Login', path: `/site/${slug}/login`, noIndex: true })
  }
  const site = shop.site
  return buildPartnerSiteMetadata({
    siteSlug: site.siteSlug,
    siteName: site.title,
    title: `${site.title} — Login`,
    description: site.partnerDisplayName,
    path: '/login',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

/** Login always uses React auth shell — never frozen visual HTML (form must work). */
export default async function PartnerSiteLoginPage({ params }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const partnerSlug = shop.partnerSlug
  if (!partnerSlug.trim()) notFound()

  return (
    <PartnerSiteShopLoginClient
      siteSlug={shop.site.siteSlug}
      partnerSlug={partnerSlug}
      shopTitle={shop.site.title}
      locale={shop.site.locale}
    />
  )
}
