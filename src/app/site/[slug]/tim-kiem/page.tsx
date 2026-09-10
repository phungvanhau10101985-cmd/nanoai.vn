import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteMobileSearchClient } from '@/components/partner-website/shop/partner-site-mobile-search-client'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { liveVisualHomeChromeShellProps } from '@/lib/partner-website/shop/live-visual-home-chrome'
import {
  readVisualPreviewDevice,
  type PartnerSiteSearchParams,
} from '@/components/partner-website/shop/partner-site-visual-html-screen'

type Props = { params: Promise<{ slug: string }>; searchParams?: PartnerSiteSearchParams }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Search',
      description: 'Search',
      path: `/site/${slug}/tim-kiem`,
      noIndex: true,
    })
  }
  const t = getPartnerSiteShopCopy(shop.site.locale)
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${t.searchComposePlaceholder.replace('{shop}', shop.site.title)} — ${shop.site.title}`,
    description: t.searchComposePlaceholder.replace('{shop}', shop.site.title),
    path: '/tim-kiem',
    noIndex: true,
    image: shop.site.logoUrl,
    locale: shop.site.locale,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteMobileSearchComposePage({ params, searchParams }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const device = await readVisualPreviewDevice(searchParams)

  return (
    <PartnerSiteShopShell
      siteSlug={shop.site.siteSlug}
      partnerSlug={shop.partnerSlug}
      title={shop.site.title}
      logoUrl={shop.site.logoUrl}
      theme={shop.site.theme}
      locale={shop.site.locale}
      chatPath={shop.site.chatPath}
      tracking={partnerSiteTrackingFromPublicRow(shop.site)}
      hideChrome
      hideAccountNav
      {...(await liveVisualHomeChromeShellProps(shop.site, device))}
    >
      <Suspense fallback={null}>
        <PartnerSiteMobileSearchClient
          siteSlug={shop.site.siteSlug}
          locale={shop.site.locale}
          shopTitle={shop.site.title}
        />
      </Suspense>
    </PartnerSiteShopShell>
  )
}
