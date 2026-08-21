import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { fetchPartnerInventoryActivePageWithCountFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteShopProductClient } from '@/components/partner-website/shop/partner-site-shop-product-client'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { visualHomeChromeShellProps } from '@/lib/partner-website/shop/visual-home-chrome'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { resolvePartnerShopProductByKey } from '@/lib/partner-website/shop/resolve-partner-shop-product-by-key'
import { buildPartnerSiteProductKey } from '@/lib/partner-website/shop/partner-site-product-slug'
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { resolvePartnerSiteAbsoluteUrl } from '@/lib/partner-website/shop/partner-site-absolute-url'
import { JsonLd } from '@/components/seo-json-ld'
import { fetchPartnerProductRatingSummaryFromPg } from '@/lib/db/messaging-partner-reviews-pg'
import {
  fetchCategoryIdsForInventoryFromPg,
  fetchPartnerCategoriesFlatFromPg,
  fetchSizeGuideImageUrlForInventoryFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import { fetchPartnerPaymentSettingsFromPg } from '@/lib/db/messaging-partner-orders-pg'
import { resolvePartnerEffectiveUnitPrice } from '@/lib/partner-website/shop/partner-shop-flash-sale'
import {
  resolvePartnerCategoryAncestors,
  resolvePartnerCategoryDisplayName,
} from '@/lib/partner-website/category/partner-category-types'
import {
  maybePartnerSiteVisualProductPage,
  readVisualPreviewDevice,
  type PartnerSiteSearchParams,
} from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  params: Promise<{ slug: string; inventoryId: string }>
  searchParams?: PartnerSiteSearchParams
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, inventoryId } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Product',
      description: 'Product',
      path: `/site/${slug}/products/${inventoryId}`,
      noIndex: true,
    })
  }
  const row = await resolvePartnerShopProductByKey(shop.partnerId, inventoryId)
  const product = row ? inventoryRowToShopProduct(shop.site.siteSlug, row) : null
  const canonicalKey = row
    ? buildPartnerSiteProductKey(row.name, row.id)
    : inventoryId
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: product ? `${product.name} — ${shop.site.title}` : shop.site.title,
    description: product?.description || shop.site.partnerDisplayName,
    path: `/products/${canonicalKey}`,
    image: product?.imageUrl,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteProductDetailPage({ params, searchParams }: Props) {
  const { slug, inventoryId } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()

  const row = await resolvePartnerShopProductByKey(shop.partnerId, inventoryId)
  const product = row ? inventoryRowToShopProduct(shop.site.siteSlug, row) : null
  if (!row || !product) notFound()

  const canonicalKey = buildPartnerSiteProductKey(row.name, row.id)
  if (decodeURIComponent(inventoryId.trim()).toLowerCase() !== canonicalKey.toLowerCase()) {
    const headerStore = headers()
    const onCustomDomain = Boolean(
      readPartnerCustomDomainFromHeaders((name) => headerStore.get(name))
    )
    redirect(
      partnerSiteProductPath(shop.site.siteSlug, row.id, {
        name: row.name,
        customDomain: onCustomDomain,
      })
    )
  }

  const device = await readVisualPreviewDevice(searchParams)
  const visual = maybePartnerSiteVisualProductPage(
    shop.site,
    row.id,
    device,
    product
  )
  if (visual) return visual

  const relatedPage = await fetchPartnerInventoryActivePageWithCountFromPg(shop.partnerId, 0, 8)
  const relatedProducts = (relatedPage?.rows ?? [])
    .filter((r) => r.id !== row.id)
    .map((r) => inventoryRowToShopProduct(shop.site.siteSlug, r))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 4)

  const sizeGuideImageUrl = await fetchSizeGuideImageUrlForInventoryFromPg(shop.partnerId, row.id)
  const productWithGuide = { ...product, sizeGuideImageUrl }

  // S0.6 — Product JSON-LD. Chỉ đưa `offers` khi có giá số thật (price_amount, W4.10) —
  // không suy đoán giá từ price_hint text để tránh dữ liệu structured data sai lệch.
  // `aggregateRating` TÍNH THẬT từ bảng review (W1.5) — chỉ đưa vào khi có ít nhất 1 review thật,
  // khác 188 (hiển thị field ảo không liên quan review thật, xem docs/188_BEHAVIOR_SPEC.md mục C.1).
  const productUrl = resolvePartnerSiteAbsoluteUrl(shop.site.siteSlug, `/products/${canonicalKey}`)
  const ratingSummary = await fetchPartnerProductRatingSummaryFromPg(shop.partnerId, row.id)
  const paymentSettings = await fetchPartnerPaymentSettingsFromPg(shop.partnerId)
  const effectivePrice = resolvePartnerEffectiveUnitPrice({
    priceAmount: row.price_amount,
    salePriceAmount: row.sale_price_amount ?? null,
    saleStartsAt: row.sale_starts_at ?? null,
    saleEndsAt: row.sale_ends_at ?? null,
  })
  const shippingFee = Math.max(0, Math.round(paymentSettings?.shipping_fee_amount ?? 0))
  const returnPolicyUrl = resolvePartnerSiteAbsoluteUrl(shop.site.siteSlug, '/pages/return-policy')
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    image: [product.imageUrl, ...product.galleryImages].filter(Boolean),
    url: productUrl,
    sku: product.sku || undefined,
    brand: { '@type': 'Brand', name: shop.site.title },
    ...(effectivePrice != null
      ? {
          offers: {
            '@type': 'Offer',
            url: productUrl,
            priceCurrency: row.price_currency || 'VND',
            price: effectivePrice,
            availability: row.stock_qty > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: { '@type': 'Organization', name: shop.site.partnerDisplayName || shop.site.title },
            shippingDetails: {
              '@type': 'OfferShippingDetails',
              shippingRate: {
                '@type': 'MonetaryAmount',
                value: shippingFee,
                currency: row.price_currency || 'VND',
              },
              shippingDestination: {
                '@type': 'DefinedRegion',
                addressCountry: 'VN',
              },
              deliveryTime: {
                '@type': 'ShippingDeliveryTime',
                handlingTime: {
                  '@type': 'QuantitativeValue',
                  minValue: 1,
                  maxValue: 3,
                  unitCode: 'DAY',
                },
                transitTime: {
                  '@type': 'QuantitativeValue',
                  minValue: 2,
                  maxValue: 7,
                  unitCode: 'DAY',
                },
              },
            },
            hasMerchantReturnPolicy: {
              '@type': 'MerchantReturnPolicy',
              applicableCountry: 'VN',
              returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
              merchantReturnDays: 7,
              returnMethod: 'https://schema.org/ReturnByMail',
              returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
              url: returnPolicyUrl,
            },
          },
        }
      : {}),
    ...(ratingSummary.total > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: ratingSummary.average,
            reviewCount: ratingSummary.total,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }

  // S0.6 (bổ sung) — BreadcrumbList JSON-LD trên PDP, đối chiếu 188 phát hiện đang thiếu.
  // Dùng danh mục CHÍNH (is_primary) gán cho sản phẩm (W4.2) — nếu SP chưa gán danh mục nào
  // (shop dùng /products phẳng, W4.3) thì bỏ qua, không suy đoán breadcrumb giả.
  const t = getPartnerSiteShopCopy(shop.site.locale)
  const homeUrl = resolvePartnerSiteAbsoluteUrl(shop.site.siteSlug, '/')
  let breadcrumbJsonLd: Record<string, unknown> | null = null
  const categoryLinks = await fetchCategoryIdsForInventoryFromPg(row.id)
  if (categoryLinks && categoryLinks.length > 0) {
    const primaryLink = categoryLinks.find((l) => l.isPrimary) ?? categoryLinks[0]
    const flatCategories = await fetchPartnerCategoriesFlatFromPg(shop.partnerId)
    const primaryCategory = flatCategories?.find((c) => c.id === primaryLink.categoryId) ?? null
    if (primaryCategory && flatCategories) {
      const ancestors = resolvePartnerCategoryAncestors(flatCategories, primaryCategory)
      const chain = [
        ...ancestors.map((a) => ({
          name: resolvePartnerCategoryDisplayName(a, shop.site.locale),
          url: resolvePartnerSiteAbsoluteUrl(shop.site.siteSlug, `/c/${a.path}`),
        })),
        {
          name: resolvePartnerCategoryDisplayName(primaryCategory, shop.site.locale),
          url: resolvePartnerSiteAbsoluteUrl(shop.site.siteSlug, `/c/${primaryCategory.path}`),
        },
      ]
      breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [{ name: t.navHome, url: homeUrl }, ...chain, { name: product.name, url: productUrl }].map(
          (item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url })
        ),
      }
    }
  }

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
      pageKind={PW_PAGE.product}
      {...visualHomeChromeShellProps(shop.site, device)}
    >
      <JsonLd data={productJsonLd} />
      {breadcrumbJsonLd ? <JsonLd data={breadcrumbJsonLd} /> : null}
      <PartnerSiteShopProductClient
        siteSlug={shop.site.siteSlug}
        partnerSlug={shop.partnerSlug}
        locale={shop.site.locale}
        product={productWithGuide}
        relatedProducts={relatedProducts}
        ratingSummary={ratingSummary}
        shippingFreeThreshold={paymentSettings?.shipping_free_threshold_amount ?? null}
      />
    </PartnerSiteShopShell>
  )
}
