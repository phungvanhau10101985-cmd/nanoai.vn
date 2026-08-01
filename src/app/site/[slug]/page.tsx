import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'
import { buildMetadata } from '@/lib/seo'
import { renderPartnerWebsiteHtml } from '@/lib/partner-website/partner-website-render'
import { PartnerSitePublicClient } from './partner-site-public-client'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug).catch(() => null)
  if (!site) {
    return buildMetadata({
      title: 'Website',
      description: 'Customer website',
      path: `/site/${slug}`,
      noIndex: true,
    })
  }
  return buildMetadata({
    title: site.title,
    description: `${site.title} — ${site.partnerDisplayName}`,
    path: `/site/${site.siteSlug}`,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSitePublicPage({ params }: Props) {
  const { slug } = await params
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug).catch(() => null)
  if (!site) notFound()

  const html = renderPartnerWebsiteHtml({
    project: site.project,
    htmlSource: site.htmlSource,
    chatPath: site.chatPath,
    siteSlug: site.siteSlug,
    locale: site.locale,
    facebookPixelId: site.facebookPixelId,
    ga4MeasurementId: site.ga4MeasurementId,
    googleAdsId: site.googleAdsId,
    tiktokPixelId: site.tiktokPixelId,
  })

  return (
    <PartnerSitePublicClient
      html={html}
      allowScripts
      chatPath={site.chatPath}
      shopName={site.title}
      logoUrl={site.logoUrl}
      locale={site.locale}
    />
  )
}
