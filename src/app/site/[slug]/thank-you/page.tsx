import type { Metadata } from 'next'
import {
  buildPartnerSiteInfoMetadata,
  PartnerSiteInfoPageScreen,
} from '@/lib/partner-website/shop/render-partner-site-info-page'

type Props = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return buildPartnerSiteInfoMetadata(slug, 'thank-you')
}

export const dynamic = 'force-dynamic'

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = searchParams ? await searchParams : {}
  const orderRaw = sp.order
  const orderId = typeof orderRaw === 'string' ? orderRaw : Array.isArray(orderRaw) ? orderRaw[0] : null
  return <PartnerSiteInfoPageScreen slug={slug} pageKey="thank-you" orderId={orderId ?? null} />
}
