import {
  fetchPartnerCategoryByIdFromPg,
  fetchCategoryIdsForInventoryFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import {
  fetchPartnerInventoryPageByCategoryFromPg,
  fetchPartnerInventoryRowsByIdsInOrderFromPg,
  type MessagingPartnerInventoryRow,
} from '@/lib/db/messaging-partner-inventory-pg'
import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
} from '@/lib/db/messaging-partner-websites-pg'
import { fetchPartnerProductRatingSummaryFromPg } from '@/lib/db/messaging-partner-reviews-pg'
import { inventoryShopDisplayDescription } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { collectShopProductGalleryImages } from '@/lib/partner-website/shop/inventory-shop-detail'
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import type { PartnerLandingPageRow } from '@/lib/partner-website/landing/partner-landing-types'
import type { LandingAiContext, LandingAiProduct } from '@/lib/partner-website/landing/landing-ai-types'

/**
 * L3.2 — Context builder: resolve sản phẩm/danh mục THẬT LIVE tại thời điểm generate — không bao
 * giờ snapshot tên/giá/ảnh. Xem docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md mục L3.2, và
 * 188_BEHAVIOR_SPEC.md (AI không ghi ngược vào products/inventory).
 */

function inventoryRowToLandingProduct(siteSlug: string, row: MessagingPartnerInventoryRow): LandingAiProduct {
  const gallery = collectShopProductGalleryImages(row)
  return {
    id: row.id,
    name: row.name?.trim() || 'Sản phẩm',
    material: row.material_note?.trim() || '',
    description: inventoryShopDisplayDescription(row),
    imageUrl: row.image_url?.trim() || gallery[0] || '',
    galleryImages: gallery,
    priceAmount: row.price_amount ?? null,
    priceHint: row.price_hint?.trim() || '',
    detailPath: partnerSiteProductPath(siteSlug, row.id, { name: row.name?.trim() || 'san-pham' }),
  }
}

function computeDominantMaterial(products: LandingAiProduct[]): string | null {
  const counts = new Map<string, number>()
  for (const p of products) {
    const m = p.material.trim()
    if (!m) continue
    counts.set(m, (counts.get(m) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [m, c] of counts) {
    if (c > bestCount) {
      best = m
      bestCount = c
    }
  }
  return best
}

export async function buildLandingAiContext(
  partnerId: string,
  landing: PartnerLandingPageRow
): Promise<LandingAiContext | null> {
  const website = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  if (!website) return null
  const partner = await fetchPartnerProfileForWebsitePg(partnerId)
  if (!partner) return null

  let rows: MessagingPartnerInventoryRow[] = []
  if (landing.sourceType === 'category' && landing.categoryId) {
    const page = await fetchPartnerInventoryPageByCategoryFromPg(partnerId, {
      categoryId: landing.categoryId,
      offset: 0,
      limit: landing.productsLimit,
      material: landing.materialFilter || undefined,
    })
    rows = page?.rows ?? []
  } else {
    rows = (await fetchPartnerInventoryRowsByIdsInOrderFromPg(partnerId, landing.inventoryIds)) ?? []
  }

  const products = rows.map((r) => inventoryRowToLandingProduct(website.siteSlug, r))

  let categoryName: string | null = null
  let categorySeoTitle: string | null = null
  let categorySeoDescription: string | null = null
  let categoryPath: string | null = null

  if (landing.sourceType === 'category' && landing.categoryId) {
    const cat = await fetchPartnerCategoryByIdFromPg(partnerId, landing.categoryId)
    if (cat) {
      categoryName = cat.name
      categorySeoTitle = cat.seoTitle || null
      categorySeoDescription = cat.seoDescription || null
      categoryPath = cat.path
    }
  } else if (products[0]) {
    // Landing "products": dùng danh mục chính của SP đầu tiên làm đối trọng SEO (đơn giản hoá
    // heuristic "danh mục chiếm đa số" của 188 — đủ dùng cho landing 1-8 SP).
    const links = await fetchCategoryIdsForInventoryFromPg(products[0].id)
    const primary = links?.find((l) => l.isPrimary) ?? links?.[0]
    if (primary) {
      const cat = await fetchPartnerCategoryByIdFromPg(partnerId, primary.categoryId)
      if (cat) {
        categoryName = cat.name
        categorySeoTitle = cat.seoTitle || null
        categorySeoDescription = cat.seoDescription || null
        categoryPath = cat.path
      }
    }
  }

  const prices = products.map((p) => p.priceAmount).filter((x): x is number => x != null && x > 0)

  // L3.9 — rating THẬT tổng hợp từ review (W1.5), không phải AI bịa số liệu tin cậy.
  let ratingSum = 0
  let ratingTotal = 0
  for (const p of products) {
    const summary = await fetchPartnerProductRatingSummaryFromPg(partnerId, p.id)
    ratingSum += summary.average * summary.total
    ratingTotal += summary.total
  }

  return {
    landingId: landing.id,
    siteSlug: website.siteSlug,
    locale: landing.locale,
    brandName: partner.brandName?.trim() || partner.displayName?.trim() || landing.title || 'Shop',
    title: landing.title,
    briefText: landing.briefText,
    sourceType: landing.sourceType,
    products,
    categoryName,
    categorySeoTitle,
    categorySeoDescription,
    categoryPath,
    materialFilter: landing.materialFilter,
    dominantMaterial: landing.materialFilter || computeDominantMaterial(products),
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    averageRating: ratingTotal > 0 ? Math.round((ratingSum / ratingTotal) * 10) / 10 : null,
    totalReviews: ratingTotal,
  }
}
