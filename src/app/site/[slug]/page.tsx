import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'
import { fetchPartnerInventoryActivePageWithCountFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { buildMetadata } from '@/lib/seo'
import { renderPartnerWebsiteHtml } from '@/lib/partner-website/partner-website-render'
import { PartnerSitePublicClient } from './partner-site-public-client'
import { PartnerSiteFashionHome } from '@/components/partner-website/shop/partner-site-fashion-home'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { buildFashionHomeCopy } from '@/lib/partner-website/shop/build-fashion-home-copy'
import { getShopTemplateSampleProducts } from '@/lib/partner-website/template/shop-template-sample-products'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { isFullLandingV1Template } from '@/lib/partner-website/template/upgrade-landing-v1-template'

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

function sampleAsShopProducts(
  siteSlug: string,
  locale: 'vi' | 'en' | 'zh' | 'ja' | 'ko'
): PartnerSiteShopProduct[] {
  const productsPath = `/site/${encodeURIComponent(siteSlug)}/products`
  return getShopTemplateSampleProducts(locale).map((p, i) => ({
    id: `sample-${i + 1}`,
    name: p.name,
    description: '',
    detailDescription: '',
    galleryImages: p.imageUrl ? [p.imageUrl] : [],
    detailImages: [],
    productVideoUrl: null,
    priceHint: p.price,
    imageUrl: p.imageUrl,
    productUrl: productsPath,
    sku: `SAMPLE-${i + 1}`,
    detailPath: productsPath,
  }))
}

export default async function PartnerSitePublicPage({ params }: Props) {
  const { slug } = await params
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug).catch(() => null)
  if (!site) notFound()

  const useModernFashionHome =
    isFullLandingV1Template(site) &&
    site.renderMode === 'template' &&
    !site.theme?.useVisualHtml

  if (useModernFashionHome) {
    const shop = await loadPartnerSiteShopContext(slug)
    if (!shop) notFound()

    const inv = await fetchPartnerInventoryActivePageWithCountFromPg(shop.partnerId, 0, 16)
    const live = (inv?.rows ?? [])
      .map((row) => inventoryRowToShopProduct(shop.site.siteSlug, row))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
    const fallback = sampleAsShopProducts(shop.site.siteSlug, shop.site.locale)
    const products = live.length ? live : fallback
    const newArrivals = products.slice(0, 8)
    const bestSellers = products.slice(0, 8).reverse()
    const copy = buildFashionHomeCopy({
      pages: shop.site.pages,
      locale: shop.site.locale,
      siteSlug: shop.site.siteSlug,
      brandTitle: shop.site.title,
    })

    return (
      <PartnerSiteFashionHome
        siteSlug={shop.site.siteSlug}
        partnerSlug={shop.partnerSlug}
        title={shop.site.title}
        logoUrl={shop.site.logoUrl}
        theme={shop.site.theme}
        locale={shop.site.locale}
        chatPath={shop.site.chatPath}
        tracking={partnerSiteTrackingFromPublicRow(shop.site)}
        copy={copy}
        newArrivals={newArrivals}
        bestSellers={bestSellers}
      />
    )
  }

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
    preferHtmlSource: site.renderMode === 'template' && !site.theme?.useVisualHtml,
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
