import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { fetchPartnerCategoriesFlatFromPg } from '@/lib/db/messaging-partner-categories-pg'
import {
  fetchPartnerInventoryPageByTextSearchFromPg,
  fetchPartnerInventoryRowsByIdsInOrderFromPg,
  fetchPartnerTextSearchFacetCountsFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { matchInventoryForPublicTextSearchApi } from '@/lib/messaging/partner-inventory-text-embedding'
import { getPartnerPublicInventorySearchDefaultLimit } from '@/lib/messaging/partner-public-search-limits'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import {
  parsePartnerCategoryListingFromSearchParams,
  partnerCategoryListingOffset,
  PARTNER_CATEGORY_PAGE_SIZE,
} from '@/lib/partner-website/shop/partner-site-category-listing'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteCategoryProductsClient } from '@/components/partner-website/shop/partner-site-category-products-client'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCategoryPath,
  partnerSiteKhoSalePath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  isSaleListingSearchTerm,
  matchPartnerCategoryPathForSearch,
  tokenizePartnerTextSearch,
} from '@/lib/partner-website/shop/partner-site-text-search'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { visualHomeChromeShellProps } from '@/lib/partner-website/shop/visual-home-chrome'
import {
  readVisualPreviewDevice,
  type PartnerSiteSearchParams,
} from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_EL, PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = { params: Promise<{ slug: string }>; searchParams?: PartnerSiteSearchParams }

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

async function listingFromPageSearchParams(searchParams: PartnerSiteSearchParams) {
  const rec = (searchParams ? await searchParams : {}) ?? {}
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(rec)) {
    const val = Array.isArray(v) ? v[0] : v
    if (val != null && String(val) !== '') u.set(k, String(val))
  }
  return parsePartnerCategoryListingFromSearchParams(u, { defaultSort: 'random' })
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  const rec = (searchParams ? await searchParams : {}) ?? {}
  const q = firstParam(rec.q)
  if (!shop) {
    return buildMetadata({
      title: 'Search',
      description: 'Search',
      path: `/site/${slug}/search`,
      noIndex: true,
    })
  }
  const t = getPartnerSiteShopCopy(shop.site.locale)
  const title = q ? t.searchForQuery.replace('{q}', q) : t.searchResults
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${title} — ${shop.site.title}`,
    description: title,
    path: '/search',
    search: q ? `q=${encodeURIComponent(q)}` : undefined,
    noIndex: !q,
    image: shop.site.logoUrl,
    locale: shop.site.locale,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteTextSearchPage({ params, searchParams }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const device = await readVisualPreviewDevice(searchParams)
  const rec = (searchParams ? await searchParams : {}) ?? {}
  const q = firstParam(rec.q)
  const t = getPartnerSiteShopCopy(shop.site.locale)
  const listing = await listingFromPageSearchParams(searchParams)

  if (q && isSaleListingSearchTerm(q)) {
    redirect(partnerSiteKhoSalePath(shop.site.siteSlug))
  }

  if (q && tokenizePartnerTextSearch(q).length) {
    const flat = await fetchPartnerCategoriesFlatFromPg(shop.partnerId, { activeOnly: true })
    const categoryPath = matchPartnerCategoryPathForSearch(q, flat ?? [])
    if (categoryPath) redirect(partnerSiteCategoryPath(shop.site.siteSlug, categoryPath))
  }

  const page = q
    ? await fetchPartnerInventoryPageByTextSearchFromPg(shop.partnerId, {
        offset: partnerCategoryListingOffset(listing),
        limit: PARTNER_CATEGORY_PAGE_SIZE,
        q,
        sort: listing.sort,
        randomSeed: listing.sort === 'random' ? listing.randomSeed || undefined : undefined,
        minPrice: listing.minPrice ?? undefined,
        maxPrice: listing.maxPrice ?? undefined,
        size: listing.size || undefined,
        color: listing.color || undefined,
        styleTag: listing.styleTag || undefined,
      })
    : { rows: [], count: 0 }

  let initialProducts = (page?.rows ?? [])
    .map((row) => inventoryRowToShopProduct(shop.site.siteSlug, row))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  let initialTotal = page?.count ?? initialProducts.length

  // Vector chỉ khi word-search chạy xong và total = 0 (188). Lỗi SQL (`page == null`) không được coi là 0 hit.
  if (page && q.length >= 2 && listing.page === 1 && initialTotal === 0) {
    const vector = await matchInventoryForPublicTextSearchApi(
      shop.partnerId,
      q,
      getPartnerPublicInventorySearchDefaultLimit()
    )
    if (vector.ok && vector.matches.length) {
      const rows = await fetchPartnerInventoryRowsByIdsInOrderFromPg(
        shop.partnerId,
        vector.matches.map((m) => m.inventory_id)
      )
      initialProducts = (rows ?? [])
        .map((row) => inventoryRowToShopProduct(shop.site.siteSlug, row))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
      initialTotal = initialProducts.length
    }
  }

  const facets = q ? await fetchPartnerTextSearchFacetCountsFromPg(shop.partnerId, q) : null
  const heading = q ? t.searchForQuery.replace('{q}', q) : t.searchResults

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
      <h1 data-pw-el={PW_EL.sectionTitle}>{heading}</h1>
      {q ? (
        <section style={{ marginTop: 24 }}>
          <Suspense fallback={<p className="pw-shop-muted">…</p>}>
            <PartnerSiteCategoryProductsClient
              siteSlug={shop.site.siteSlug}
              searchQuery={q}
              locale={shop.site.locale}
              initialProducts={initialProducts}
              initialTotal={initialTotal}
              priceRange={null}
              initialFacets={facets ?? { sizes: [], colors: [], styleTags: [] }}
            />
          </Suspense>
        </section>
      ) : (
        <p className="pw-shop-muted">{t.searchEmpty}</p>
      )}
    </PartnerSiteShopShell>
  )
}
