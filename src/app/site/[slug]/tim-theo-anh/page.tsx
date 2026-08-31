import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteImageSearchClient } from '@/components/partner-website/shop/partner-site-image-search-client'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { visualHomeChromeShellProps } from '@/lib/partner-website/shop/visual-home-chrome'
import {
  readVisualPreviewDevice,
  type PartnerSiteSearchParams,
} from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = { params: Promise<{ slug: string }>; searchParams?: PartnerSiteSearchParams }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Image search',
      description: 'Image search',
      path: `/site/${slug}/tim-theo-anh`,
      noIndex: true,
    })
  }
  const t = getPartnerSiteShopCopy(shop.site.locale)
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${t.imageSearchTitle} — ${shop.site.title}`,
    description: t.imageSearchHint,
    path: '/tim-theo-anh',
    noIndex: true,
    image: shop.site.logoUrl,
    locale: shop.site.locale,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteImageSearchPage({ params, searchParams }: Props) {
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
      footerJson={shop.site.footerJson}
      navJson={shop.site.navJson}
      activeNav="products"
      pageKind={PW_PAGE.listing}
      {...visualHomeChromeShellProps(shop.site, device)}
    >
      <PartnerSiteImageSearchClient siteSlug={shop.site.siteSlug} locale={shop.site.locale} />
    </PartnerSiteShopShell>
  )
}
