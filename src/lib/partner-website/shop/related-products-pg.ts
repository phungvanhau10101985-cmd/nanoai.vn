import {
  fetchCategoryIdsForInventoryFromPg,
  fetchPartnerCategoriesFlatFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import {
  fetchPartnerInventoryActiveCardPageWithCountFromPg,
  fetchPartnerInventoryCardPageByCategoryFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import {
  inventoryCardRowToShopProduct,
  type PartnerSiteShopProduct,
} from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteSaleOverlay, withPartnerSiteSale } from '@/lib/partner-website/promotions/partner-site-sale-attach'
import {
  PW_RELATED_LIMIT_DEFAULT,
  type RelatedProductContext,
} from '@/lib/partner-website/shop/related-products'

export async function resolveRelatedProductContext(
  partnerId: string,
  inventoryId: string
): Promise<RelatedProductContext> {
  const links = await fetchCategoryIdsForInventoryFromPg(inventoryId)
  if (!links?.length) return { categoryId: null, categoryPath: null }
  const primary = links.find((l) => l.isPrimary) ?? links[0]
  const flat = await fetchPartnerCategoriesFlatFromPg(partnerId)
  const category = flat?.find((c) => c.id === primary.categoryId) ?? null
  return {
    categoryId: primary.categoryId,
    categoryPath: category?.path?.trim() || null,
  }
}

export async function fetchRelatedShopProducts(input: {
  partnerId: string
  siteSlug: string
  excludeId: string
  categoryId?: string | null
  limit?: number
}): Promise<PartnerSiteShopProduct[]> {
  const limit = Math.min(48, Math.max(1, Math.floor(input.limit ?? PW_RELATED_LIMIT_DEFAULT)))
  const excludeId = String(input.excludeId || '').trim()
  const categoryId = String(input.categoryId || '').trim()
  const page = categoryId
    ? await fetchPartnerInventoryCardPageByCategoryFromPg(input.partnerId, {
        offset: 0,
        limit: limit + 1,
        categoryId,
        sort: 'newest',
      })
    : await fetchPartnerInventoryActiveCardPageWithCountFromPg(input.partnerId, 0, limit + 1)
  const overlay = await loadPartnerSiteSaleOverlay(input.partnerId).catch(() => null)
  return (page?.rows ?? [])
    .filter((row) => row.id !== excludeId)
    .map((row) => {
      const mapped = inventoryCardRowToShopProduct(input.siteSlug, row)
      return withPartnerSiteSale(mapped, overlay)
    })
    .filter((p): p is PartnerSiteShopProduct => Boolean(p))
    .slice(0, limit)
}
