import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import {
  fetchDirectProductCountsByCategoryFromPg,
  fetchPartnerCategoriesFlatFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import {
  fetchPartnerCategoryPriceRangeFromPg,
  fetchPartnerInventoryPageByCategoryFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  resolvePartnerCategoryDisplayDescription,
  resolvePartnerCategoryDisplayName,
  type PartnerCategoryRow,
} from '@/lib/partner-website/category/partner-category-types'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteCategoryProductsClient } from '@/components/partner-website/shop/partner-site-category-products-client'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCategoryPath,
  partnerSiteHomePath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { resolvePartnerSiteAbsoluteUrl } from '@/lib/partner-website/shop/partner-site-absolute-url'
import { JsonLd } from '@/components/seo-json-ld'
import { maybePartnerSiteVisualCategoryPage } from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_EL, PW_PAGE, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = { params: Promise<{ slug: string; path: string[] }> }

/**
 * W4.7/W4.9 — trang danh mục công khai `/site/{slug}/c/{...path}`.
 * Danh mục có con: hiện tile danh mục con TRƯỚC lưới sản phẩm (khác 188 — bỏ qua bước này).
 * Sản phẩm hiển thị là sản phẩm gán TRỰC TIẾP (chưa gộp nhánh con) — xem docs/188_BEHAVIOR_SPEC.md mục A.4.
 */

async function resolveCategoryContext(slug: string, pathSegments: string[]) {
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return null
  const joinedPath = pathSegments
    .map((s) => decodeURIComponent(s).trim().toLowerCase())
    .filter(Boolean)
    .join('/')
  if (!joinedPath) return null

  const flat = await fetchPartnerCategoriesFlatFromPg(shop.partnerId, { activeOnly: true })
  if (!flat) return null
  const category = flat.find((c) => c.path === joinedPath)
  if (!category) return null

  const ancestors: PartnerCategoryRow[] = []
  const segs = joinedPath.split('/')
  for (let i = 1; i < segs.length; i += 1) {
    const prefix = segs.slice(0, i).join('/')
    const found = flat.find((c) => c.path === prefix)
    if (found) ancestors.push(found)
  }

  const children = flat
    .filter((c) => c.parentId === category.id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  return { shop, category, ancestors, children }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
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
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${category.seoTitle?.trim() || name} — ${shop.site.title}`,
    description,
    path: `/c/${category.path}`,
    noIndex: !category.seoIndex,
    image: category.imageUrl || shop.site.logoUrl,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteCategoryPage({ params }: Props) {
  const { slug, path } = await params
  const ctx = await resolveCategoryContext(slug, path)
  if (!ctx) notFound()
  const { shop, category, ancestors, children } = ctx
  const visual = maybePartnerSiteVisualCategoryPage(shop.site, category.path)
  if (visual) return visual
  const t = getPartnerSiteShopCopy(shop.site.locale)
  const locale = shop.site.locale

  const [counts, page, priceRange] = await Promise.all([
    fetchDirectProductCountsByCategoryFromPg(shop.partnerId),
    fetchPartnerInventoryPageByCategoryFromPg(shop.partnerId, {
      offset: 0,
      limit: 24,
      categoryId: category.id,
    }),
    fetchPartnerCategoryPriceRangeFromPg(shop.partnerId, category.id),
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

      {children.length > 0 ? (
        <section style={{ marginTop: 20 }} data-pw-region={PW_REGION.categories}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600 }} data-pw-el={PW_EL.sectionTitle}>{t.categorySubcategoriesLabel}</h2>
          <div className="pw-shop-category-tiles">
            {children.map((child) => {
              const childName = resolvePartnerCategoryDisplayName(child, locale)
              const count = counts?.get(child.id) ?? 0
              return (
                <Link
                  key={child.id}
                  href={partnerSiteCategoryPath(shop.site.siteSlug, child.path)}
                  className="pw-shop-category-tile"
                  data-pw-el={PW_EL.card}
                >
                  {child.imageUrl ? (
                    <img src={child.imageUrl} alt={childName} loading="lazy" data-pw-el={PW_EL.cardMedia} />
                  ) : (
                    <span className="pw-shop-category-tile-placeholder" data-pw-el={PW_EL.cardMedia} />
                  )}
                  <span className="pw-shop-category-tile-name" data-pw-el={PW_EL.cardName}>{childName}</span>
                  {count > 0 ? <span className="pw-shop-category-tile-count">{count}</span> : null}
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}

      <section style={{ marginTop: 24 }}>
        <PartnerSiteCategoryProductsClient
          siteSlug={shop.site.siteSlug}
          categoryId={category.id}
          locale={locale}
          initialProducts={initialProducts}
          initialTotal={page?.count ?? initialProducts.length}
          priceRange={priceRange}
        />
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
