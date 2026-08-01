import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { fetchHubLandingPageShareByTokenPg } from '@/lib/db/hub-landing-page-share-pg'
import { HubLandingSharePublicClient } from './hub-landing-share-public-client'
import { HubLandingHtmlDocument } from './hub-landing-html-document'

type Props = { params: { token: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const row = await fetchHubLandingPageShareByTokenPg(params.token).catch(() => null)
  const title = row?.title?.trim() || 'Landing Page'
  return buildMetadata({
    title,
    description: 'Stacked landing segment mockup preview — design images only, not a live website.',
    path: `/share/landing/${params.token}`,
    noIndex: true,
  })
}

export default async function HubLandingSharePage({ params }: Props) {
  const row = await fetchHubLandingPageShareByTokenPg(params.token).catch(() => null)
  if (!row) notFound()

  if (row.html_source) {
    return <HubLandingHtmlDocument html={row.html_source} />
  }

  return (
    <HubLandingSharePublicClient
      title={row.title}
      logoUrl={row.logo_url}
      sections={row.sections_json}
      locale={row.locale}
    />
  )
}
