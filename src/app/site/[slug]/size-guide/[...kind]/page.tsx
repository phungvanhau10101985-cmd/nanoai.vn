import type { Metadata } from 'next'
import {
  buildPartnerSiteSizeGuideKindMetadata,
  PartnerSiteSizeGuideKindPageScreen,
} from '@/lib/partner-website/shop/render-partner-site-info-page'

type Props = { params: Promise<{ slug: string; kind: string[] }> }

function kindRawFromParams(kind: string[] | undefined): string {
  return (kind ?? []).map((s) => decodeURIComponent(String(s || ''))).filter(Boolean).join('/')
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, kind } = await params
  return buildPartnerSiteSizeGuideKindMetadata(slug, kindRawFromParams(kind))
}

export const dynamic = 'force-dynamic'

export default async function Page({ params }: Props) {
  const { slug, kind } = await params
  return <PartnerSiteSizeGuideKindPageScreen slug={slug} kindRaw={kindRawFromParams(kind)} />
}
