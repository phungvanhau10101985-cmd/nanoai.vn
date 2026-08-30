import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { fetchPartnerCategoriesFlatFromPg } from '@/lib/db/messaging-partner-categories-pg'
import {
  fetchPartnerCategoryFacetCountsFromPg,
  fetchPartnerCategoryPriceRangeFromPg,
  fetchPartnerInventoryPageByCategoryFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  prunePartnerCategoriesMissingAncestors,
  resolvePartnerCategoryDisplayDescription,
  resolvePartnerCategoryDisplayName,
  type PartnerCategoryRow,
} from '@/lib/partner-website/category/partner-category-types'
import {
  buildPartnerCategoryCanonicalQuery,
  parsePartnerCategoryListingFromRecord,
  partnerCategoryListingOffset,
  PARTNER_CATEGORY_PAGE_SIZE,
} from '@/lib/partner-website/shop/partner-site-category-listing'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteCategoryProductsClient } from '@/components/partner-website/shop/partner-site-category-products-client'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCategoryPath,
  partnerSiteHomePath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { visualHomeChromeShellProps } from '@/lib/partner-website/shop/visual-home-chrome'
import { resolvePartnerSiteAbsoluteUrl } from '@/lib/partner-website/shop/partner-site-absolute-url'
import { JsonLd } from '@/components/seo-json-ld'
import {
  maybePartnerSiteVisualCategoryPage,
  readVisualPreviewDevice,
  type PartnerSiteSearchParams,
} from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_EL, PW_PAGE, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  params: Promise<{ slug: string; path: string[] }>
  searchParams?: PartnerSiteSearchParams
}

/**
 * W4.7/W4.14 — trang danh mục `/site/{slug}/c/{...path}`.
 * Chỉ breadcrumb + tiêu đề + bộ lọc + lưới SP + head. Không khối «Danh mục con».
 * Sản phẩm gộp cả nhánh con. Filter/sort trên URL.
 */

async function resolveCategoryContext(slug: string, pathSegments: string[]) {
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return null
  const joinedPath = pathSegments
    .map((s) => decodeURIComponent(s).trim().toLowerCase())
    .filter(Boolean)
    .join('/')
  if (!joinedPath) return null

  const flatRaw = await fetchPartnerCategoriesFlatFromPg(shop.partnerId, { activeOnly: true })
  if (!flatRaw) return null
  const flat = prunePartnerCategoriesMissingAncestors(flatRaw)
  const category = flat.find((c) => c.path === joinedPath)
  if (!category) return null

  const ancestors: PartnerCategoryRow[] = []
  const segs = joinedPath.split('/')
  for (let i = 1; i < segs.length; i += 1) {
    const prefix = segs.slice(0, i).join('/')
    const found = flat.find((c) => c.path === prefix)
    if (found) ancestors.push(found)
  }

  return { shop, category, ancestors, flat }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug, path } = await params
  const ctx = await resolveCategoryContext(slug, path)
  if (!ctx) {
    return buildMetadata({ title: 'Category', description: 'Category', path: `/site/${slug}/c/${path.join('/')}`, noIndex: true })
  }
  const { shop, category } = ctx
  const name = resolvePartnerCategoryDisplayName(category, shop.site.locale)
  const description =
    (category.seoDescription?.trim() || resolvePartnerCategoryDisplayDescription(category, shop.site.locale)).slice(0, 160) ||
    shop.site.partnerDisplayName
  const listing = parsePartnerCategoryListingFromRecord((searchParams ? await searchParams : {}) ?? {})
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${category.seoTitle?.trim() || name} — ${shop.site.title}`,
    description,
    path: `/c/${category.path}`,
    search: buildPartnerCategoryCanonicalQuery(listing) || undefined,
    noIndex: !category.seoIndex,
    image: category.imageUrl || shop.site.logoUrl,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteCategoryPage({ params, searchParams }: Props) {
  const { slug, path } = await params
  const ctx = await resolveCategoryContext(slug, path)
  if (!ctx) notFound()
  const { shop, category, ancestors } = ctx
  const device = await readVisualPreviewDevice(searchParams)
  const visual = maybePartnerSiteVisualCategoryPage(
    shop.site,
    category.path,
    device
  )
  if (visual) return visual
  const t = getPartnerSiteShopCopy(shop.site.locale)
  const locale = shop.site.locale

  const listing = parsePartnerCategoryListingFromRecord((searchParams ? await searchParams : {}) ?? {})
  const [page, priceRange, facets] = await Promise.all([
    fetchPartnerInventoryPageByCategoryFromPg(shop.partnerId, {
      offset: partnerCategoryListingOffset(listing),
      limit: PARTNER_CATEGORY_PAGE_SIZE,
      categoryId: category.id,
      sort: listing.sort,
      randomSeed: listing.randomSeed || undefined,
      minPrice: listing.minPrice ?? undefined,
      maxPrice: listing.maxPrice ?? undefined,
      size: listing.size || undefined,
      color: listing.color || undefined,
    }),
    fetchPartnerCategoryPriceRangeFromPg(shop.partnerId, category.id),
    fetchPartnerCategoryFacetCountsFromPg(shop.partnerId, category.id),
  ])

  const initialProducts = (page?.rows ?? [])
    .map((row) => inventoryRowToShopProduct(shop.site.siteSlug, row))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  const categoryName = resolvePartnerCategoryDisplayName(category, locale)
  const categoryDescription = resolvePartnerCategoryDisplayDescription(category, locale)

  // W4.12 — BreadcrumbList + CollectionPage dùng URL GỐC chưa lọc (giống 188, xem
  // docs/188_BEHAVIOR_SPEC.md mục A.5 — hợp lý ngay cả khi trang có filter/phân trang).
  const homeUrl = resolvePartnerSiteAbsoluteUrl(shop.site.siteSlug, '/')
  const categoryUrl = resolvePartnerSiteAbsoluteUrl(shop.site.siteSlug, `/c/${category.path}`)
  const breadcrumbItems = [
    { name: t.navHome, url: homeUrl },
    ...ancestors.map((a) => ({
      name: resolvePartnerCategoryDisplayName(a, locale),
      url: resolvePartnerSiteAbsoluteUrl(shop.site.siteSlug, `/c/${a.path}`),
    })),
    { name: categoryName, url: categoryUrl },
  ]
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: categoryName,
    description: categoryDescription || undefined,
    url: categoryUrl,
    numberOfItems: page?.count ?? initialProducts.length,
    isPartOf: { '@type': 'WebSite', name: shop.site.title, url: homeUrl },
  }

  return (
    <PartnerSiteShopShell
      siteSlug={shop.site.siteSlug}
      partnerSlug={shop.partnerSlug}
      title={shop.site.title}
      logoUrl={shop.site.logoUrl}
      theme={shop.site.theme}
      locale={locale}
      chatPath={shop.site.chatPath}
      tracking={partnerSiteTrackingFromPublicRow(shop.site)}
      footerJson={shop.site.footerJson}
      navJson={shop.site.navJson}
      activeNav="products"
      pageKind={PW_PAGE.listing}
      {...visualHomeChromeShellProps(shop.site, device)}
    >
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={collectionPageJsonLd} />
      <nav className="pw-shop-breadcrumb" data-pw-region={PW_REGION.breadcrumb} aria-label="Breadcrumb">
        <Link href={partnerSiteHomePath(shop.site.siteSlug)} data-pw-el={PW_EL.crumb}>{t.navHome}</Link>
        {ancestors.map((a) => (
          <span key={a.id}>
            {' / '}
            <Link href={partnerSiteCategoryPath(shop.site.siteSlug, a.path)} data-pw-el={PW_EL.crumb}>
              {resolvePartnerCategoryDisplayName(a, locale)}
            </Link>
          </span>
        ))}
        <span data-pw-el={PW_EL.crumb}>{' / '}{categoryName}</span>
      </nav>

      {category.imageUrl ? (
        <div className="pw-shop-category-banner">
          <img src={category.imageUrl} alt={categoryName} />
          <h1 data-pw-el={PW_EL.sectionTitle}>{categoryName}</h1>
        </div>
      ) : (
        <h1 data-pw-el={PW_EL.sectionTitle}>{categoryName}</h1>
      )}
      {categoryDescription ? <p className="pw-shop-muted">{categoryDescription}</p> : null}

      <section style={{ marginTop: 24 }}>
        <Suspense fallback={<p className="pw-shop-muted">…</p>}>
          <PartnerSiteCategoryProductsClient
            siteSlug={shop.site.siteSlug}
            categoryId={category.id}
            locale={locale}
            initialProducts={initialProducts}
            initialTotal={page?.count ?? initialProducts.length}
            priceRange={priceRange}
            initialFacets={facets ?? { sizes: [], colors: [] }}
          />
        </Suspense>
      </section>

      {/* W4.12 (bổ sung) — đoạn văn SEO cuối trang, AI sinh hoặc merchant tự viết qua nút
          "Tự động sinh bằng AI" trong quản trị danh mục. Tương đương seo_body của 188. */}
      {category.seoBody.trim() ? (
        <section
          style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e5e7eb' }}
          aria-label={t.categorySeoBodyAriaLabel}
        >
          <p className="pw-shop-muted" style={{ whiteSpace: 'pre-line', fontSize: '0.85rem', lineHeight: 1.7 }}>
            {category.seoBody.trim()}
          </p>
        </section>
      ) : null}
    </PartnerSiteShopShell>
  )
}
