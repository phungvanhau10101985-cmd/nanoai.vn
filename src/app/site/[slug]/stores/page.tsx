import type { Metadata } from 'next'
import {
  buildPartnerSiteInfoMetadata,
  PartnerSiteInfoPageScreen,
} from '@/lib/partner-website/shop/render-partner-site-info-page'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return buildPartnerSiteInfoMetadata(slug, 'stores')
}

export const dynamic = 'force-dynamic'

export default async function Page({ params }: Props) {
  const { slug } = await params
  return <PartnerSiteInfoPageScreen slug={slug} pageKey="stores" />
}
