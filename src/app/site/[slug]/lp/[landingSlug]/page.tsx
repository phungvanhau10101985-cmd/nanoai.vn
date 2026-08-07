import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchPublishedPartnerLandingBySiteAndSlugPg } from '@/lib/db/messaging-partner-landing-pages-pg'
import { loadPartnerLandingProductSnapshots } from '@/lib/partner-website/landing/partner-landing-products'
import { renderPartnerLandingHtml } from '@/lib/partner-website/landing/render-partner-landing-html'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { PartnerSitePublicClient } from '../../partner-site-public-client'

type Props = {
  params: Promise<{ slug: string; landingSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, landingSlug } = await params
  const landing = await fetchPublishedPartnerLandingBySiteAndSlugPg(slug, landingSlug).catch(
    () => null
  )
  if (!landing) {
    return buildMetadata({
      title: 'Landing',
      description: 'Landing page',
      path: `/site/${slug}/lp/${landingSlug}`,
      noIndex: true,
    })
  }
  return buildPartnerSiteMetadata({
    siteSlug: landing.siteSlug,
    siteName: landing.title,
    title: landing.title,
    description: landing.briefText.slice(0, 160) || landing.title,
    path: `/lp/${landing.landingSlug}`,
    image: landing.logoUrl,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerLandingPublicPage({ params }: Props) {
  const { slug, landingSlug } = await params
  const landing = await fetchPublishedPartnerLandingBySiteAndSlugPg(slug, landingSlug).catch(
    () => null
  )
  if (!landing) notFound()

  const products = await loadPartnerLandingProductSnapshots({
    partnerId: landing.partnerId,
    siteSlug: landing.siteSlug,
    inventoryIds: landing.inventoryIds,
  })

  const html = renderPartnerLandingHtml({
    project: landing.project,
    htmlSource: landing.htmlSource,
    chatPath: landing.chatPath,
    siteSlug: landing.siteSlug,
    locale: landing.locale,
    products,
  })

  return (
    <PartnerSitePublicClient
      html={html}
      allowScripts
      chatPath={landing.chatPath}
      shopName={landing.title}
      logoUrl={landing.logoUrl}
      locale={landing.locale}
    />
  )
}
