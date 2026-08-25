import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'
import { fetchPartnerInventoryActivePageWithCountFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { renderPartnerWebsiteHtml } from '@/lib/partner-website/partner-website-render'
import { PartnerSitePublicClient } from './partner-site-public-client'
import { maybePartnerSiteVisualPage, readVisualPreviewDevice } from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PartnerSiteFashionHome } from '@/components/partner-website/shop/partner-site-fashion-home'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import {
  buildPartnerSiteHomeCopy,
  partnerSiteHomeIndustryBadge,
  partnerSiteHomeSecondaryCta,
} from '@/lib/partner-website/shop/build-partner-site-home-copy'
import { getShopTemplateSampleProducts } from '@/lib/partner-website/template/shop-template-sample-products'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { isPartnerFlashSaleActive } from '@/lib/partner-website/shop/partner-shop-flash-sale'
import { isFullLandingV1Template } from '@/lib/partner-website/template/upgrade-landing-v1-template'
import { injectPartnerCustomDomainLinkRewriteScript } from '@/lib/partner-website/shop/inject-partner-custom-domain-link-script'
import { injectPartnerLogoHomeLinkScript } from '@/lib/partner-website/shop/inject-partner-logo-home-link'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
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
  const base = buildPartnerSiteMetadata({
    siteSlug: site.siteSlug,
    siteName: site.title,
    title: site.title,
    description: `${site.title} — ${site.partnerDisplayName}`,
    path: '/',
    image: site.logoUrl,
    locale: site.locale,
  })
  if (site.logoUrl) {
    base.icons = {
      icon: [{ url: site.logoUrl }],
      shortcut: [{ url: site.logoUrl }],
      apple: [{ url: site.logoUrl }],
    }
  }
  return base
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
    stockQty: 0,
  }))
}

export default async function PartnerSitePublicPage({ params, searchParams }: Props) {
  const { slug } = await params
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug, { allowDraft: true }).catch(() => null)
  if (!site) notFound()

  const previewDevice = await readVisualPreviewDevice(searchParams)
  const visual = maybePartnerSiteVisualPage(site, 'home', previewDevice)
  if (visual) return visual

  const useShopHome = isFullLandingV1Template(site) && site.renderMode === 'template'

  if (useShopHome) {
    const shop = await loadPartnerSiteShopContext(slug)
    if (!shop) notFound()

    const bookingEnabled = shop.industryKey === 'hotel'
    const inv = await fetchPartnerInventoryActivePageWithCountFromPg(shop.partnerId, 0, 16)
    const live = (inv?.rows ?? [])
      .map((row) => inventoryRowToShopProduct(shop.site.siteSlug, row))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
    const fallback = sampleAsShopProducts(shop.site.siteSlug, shop.site.locale)
    const products = live.length ? live : fallback
    const newArrivals = products.slice(0, 8)
    const bestSellers = products.slice(0, 8).reverse()
    const flashSale = products.filter((p) =>
      isPartnerFlashSaleActive({
        priceAmount: p.priceAmount ?? null,
        salePriceAmount: p.salePriceAmount ?? null,
        saleStartsAt: p.saleStartsAt ?? null,
        saleEndsAt: p.saleEndsAt ?? null,
      })
    )
    const copy = buildPartnerSiteHomeCopy({
      pages: shop.site.pages,
      locale: shop.site.locale,
      siteSlug: shop.site.siteSlug,
      brandTitle: shop.site.title,
      industryKey: shop.industryKey,
    })
    const bookingHref = bookingEnabled
      ? `/hospitality/p/${encodeURIComponent(shop.partnerSlug)}`
      : undefined

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
        flashSale={flashSale}
        showProductSections
        showCategories
        showPersonalize
        heroCtaHref={bookingHref}
        industryBadge={partnerSiteHomeIndustryBadge(shop.site.locale, shop.industryKey)}
        secondaryCtaLabel={partnerSiteHomeSecondaryCta(shop.site.locale, shop.industryKey)}
        footerJson={shop.site.footerJson}
        navJson={shop.site.navJson}
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
    preferHtmlSource: (site.htmlSource?.trim().length ?? 0) >= 40,
  })

  const headerStore = headers()
  const onCustomDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))
  const withLogoHome = injectPartnerLogoHomeLinkScript(html, site.siteSlug, onCustomDomain)
  const publicHtml = onCustomDomain
    ? injectPartnerCustomDomainLinkRewriteScript(withLogoHome, site.siteSlug)
    : withLogoHome

  return (
    <PartnerSitePublicClient
      html={publicHtml}
      allowScripts
      chatPath={site.chatPath}
      shopName={site.title}
      logoUrl={site.logoUrl}
      locale={site.locale}
      inlineHtml={onCustomDomain}
      initialDevice={previewDevice}
      hideChatLauncher={site.theme?.hideChatLauncher}
    />
  )
}
