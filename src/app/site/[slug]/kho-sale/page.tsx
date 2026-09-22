import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { inventoryCardRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { applyPartnerStorefrontSaleFaces, loadPartnerSiteSaleOverlay } from '@/lib/partner-website/promotions/partner-site-sale-attach'
import { resolvePartnerStorefrontSaleIdentity } from '@/lib/partner-website/shop/partner-site-personalization'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteCategoryProductsClient } from '@/components/partner-website/shop/partner-site-category-products-client'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { liveVisualHomeChromeShellProps } from '@/lib/partner-website/shop/live-visual-home-chrome'
import {
  fetchPartnerInventoryShopCardPageFromPg,
  fetchPartnerShopListFacetCountsFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  parsePartnerCategoryListingFromRecord,
  partnerCategoryListingOffset,
  PARTNER_CATEGORY_PAGE_SIZE,
} from '@/lib/partner-website/shop/partner-site-category-listing'
import {
  readVisualPreviewDevice,
  type PartnerSiteSearchParams,
} from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_EL, PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = { params: Promise<{ slug: string }>; searchParams?: PartnerSiteSearchParams }

async function listingFromPageSearchParams(searchParams: PartnerSiteSearchParams) {
  const rec = (searchParams ? await searchParams : {}) ?? {}
  return parsePartnerCategoryListingFromRecord(rec)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({ title: 'Sale kho', description: 'Warehouse sale', path: `/site/${slug}/kho-sale`, noIndex: true })
  }
  const t = getPartnerSiteShopCopy(shop.site.locale)
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${t.khoSalePageTitle} — ${shop.site.title}`,
    description: t.khoSaleNavBlurb,
    path: '/kho-sale',
    image: shop.site.logoUrl,
    locale: shop.site.locale,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteKhoSalePage({ params, searchParams }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const device = await readVisualPreviewDevice(searchParams)
  const t = getPartnerSiteShopCopy(shop.site.locale)
  const listing = await listingFromPageSearchParams(searchParams)
  const listQuery = {
    warehouse: true as const,
    minPrice: listing.minPrice ?? undefined,
    maxPrice: listing.maxPrice ?? undefined,
    size: listing.size || undefined,
    color: listing.color || undefined,
    styleTag: listing.styleTag || undefined,
  }
  const [page, facets] = await Promise.all([
    fetchPartnerInventoryShopCardPageFromPg(shop.partnerId, {
      offset: partnerCategoryListingOffset(listing),
      limit: PARTNER_CATEGORY_PAGE_SIZE,
      sort: listing.sort,
      randomSeed: listing.sort === 'random' ? listing.randomSeed || undefined : undefined,
      ...listQuery,
    }),
    fetchPartnerShopListFacetCountsFromPg(shop.partnerId, listQuery),
  ])
  const overlay = await loadPartnerSiteSaleOverlay(shop.partnerId).catch(() => null)
  const identity = await resolvePartnerStorefrontSaleIdentity(shop.partnerId)
  const mapped = (page?.rows ?? [])
    .map((row) => inventoryCardRowToShopProduct(shop.site.siteSlug, row))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  const initialProducts = await applyPartnerStorefrontSaleFaces(mapped, {
    partnerId: shop.partnerId,
    ...identity,
    overlay,
  })

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
      {...(await liveVisualHomeChromeShellProps(shop.site, device))}
    >
      <h1 data-pw-el={PW_EL.sectionTitle}>{t.khoSalePageTitle}</h1>
      <p className="pw-shop-muted" style={{ margin: '0 0 8px' }}>
        {t.khoSaleNavBlurb}
      </p>
      <PartnerSiteCategoryProductsClient
        siteSlug={shop.site.siteSlug}
        warehouse
        locale={shop.site.locale}
        initialProducts={initialProducts}
        initialTotal={page?.count ?? initialProducts.length}
        priceRange={null}
        initialFacets={facets ?? { sizes: [], colors: [], styleTags: [] }}
        initialListing={listing}
      />
    </PartnerSiteShopShell>
  )
}
