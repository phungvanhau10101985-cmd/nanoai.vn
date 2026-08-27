import {
  assignInventoryToCategoryFromPg,
  fetchPartnerCategoryByPathFromPg,
  insertPartnerCategoryFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import {
  applyPartnerInventoryCatalogPatchFromPg,
  countPartnerInventoryFromPg,
  fetchPartnerInventorySkusFromPg,
  insertPartnerInventoryShopDemoFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import {
  SHOP_DEMO_PRODUCTS,
  isShoppingShopIndustry,
  shopDemoSkuList,
  type ShopDemoProduct,
} from '@/lib/messaging/shop-demo-catalog'
import {
  shopDemoCategoryL3,
  shopDemoProductToCatalog188Fields,
} from '@/lib/messaging/shop-demo-catalog-188'
import type { PartnerCategoryNameI18n } from '@/lib/partner-website/category/partner-category-types'

export type SeedShopDemoInventoryResult = {
  ok: boolean
  inserted: number
  skipped: number
  error?: string
}

function categoryNameI18n(vi: string, en: string): PartnerCategoryNameI18n {
  return { vi, en, zh: en, ja: en, ko: en }
}

async function ensureDemoCategory(
  partnerId: string,
  slug: string,
  name: string,
  nameEn: string,
  sortOrder: number
): Promise<string | null> {
  const existingRoot = await fetchPartnerCategoryByPathFromPg(partnerId, slug, { activeOnly: false })
  if (existingRoot) return existingRoot.id

  const created = await insertPartnerCategoryFromPg({
    partnerId,
    parentId: null,
    slug,
    name,
    nameI18n: categoryNameI18n(name, nameEn),
    sortOrder,
    isActive: true,
  })
  if (created.ok) return created.row.id
  if (created.error === 'duplicate_path' || created.error === 'duplicate_slug') {
    const again = await fetchPartnerCategoryByPathFromPg(partnerId, slug, { activeOnly: false })
    return again?.id ?? null
  }
  return null
}

async function ensureDemoCategoryChild(
  partnerId: string,
  parentId: string,
  parentSlug: string,
  slug: string,
  name: string,
  nameEn: string,
  sortOrder: number
): Promise<string | null> {
  const fullPath = `${parentSlug}/${slug}`
  const existing = await fetchPartnerCategoryByPathFromPg(partnerId, fullPath, { activeOnly: false })
  if (existing) return existing.id

  const created = await insertPartnerCategoryFromPg({
    partnerId,
    parentId,
    slug,
    name,
    nameI18n: categoryNameI18n(name, nameEn),
    sortOrder,
    isActive: true,
  })
  if (created.ok) return created.row.id
  if (created.error === 'duplicate_path' || created.error === 'duplicate_slug') {
    const again = await fetchPartnerCategoryByPathFromPg(partnerId, fullPath, { activeOnly: false })
    return again?.id ?? null
  }
  return null
}

async function categoryIdForDemoProduct(partnerId: string, product: ShopDemoProduct): Promise<string | null> {
  const parentId = await ensureDemoCategory(
    partnerId,
    product.category.parent.slug,
    product.category.parent.name,
    product.category.parent.nameEn,
    0
  )
  if (!parentId) return null
  const childId = await ensureDemoCategoryChild(
    partnerId,
    parentId,
    product.category.parent.slug,
    product.category.child.slug,
    product.category.child.name,
    product.category.child.nameEn,
    0
  )
  if (!childId) return null
  const l3 = shopDemoCategoryL3(product)
  return ensureDemoCategoryChild(
    partnerId,
    childId,
    `${product.category.parent.slug}/${product.category.child.slug}`,
    l3.slug,
    l3.name,
    l3.nameEn,
    0
  )
}

/**
 * Gắn 9 sản phẩm demo (túi / giày / quần áo) đủ cột catalog 188 vào kho shop.
 * Idempotent theo SKU `DEMO-188-*`: đã có thì bỏ qua; đã xóa thì thêm lại.
 */
export async function seedShopDemoInventoryForPartner(
  partnerId: string,
  options: { onlyIfEmpty?: boolean } = {}
): Promise<SeedShopDemoInventoryResult> {
  const pid = partnerId.trim()
  if (!pid) return { ok: false, inserted: 0, skipped: 0, error: 'partnerId required' }
  if (!isPgConfigured()) return { ok: false, inserted: 0, skipped: 0, error: 'db_not_configured' }

  if (options.onlyIfEmpty) {
    const existingCount = await countPartnerInventoryFromPg(pid)
    if (existingCount > 0) return { ok: true, inserted: 0, skipped: SHOP_DEMO_PRODUCTS.length }
  }

  const existingSkus = await fetchPartnerInventorySkusFromPg(pid, shopDemoSkuList())
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < SHOP_DEMO_PRODUCTS.length; i++) {
    const product = SHOP_DEMO_PRODUCTS[i]
    if (existingSkus.has(product.sku)) {
      skipped += 1
      continue
    }
    const catalog = shopDemoProductToCatalog188Fields(product, SHOP_DEMO_PRODUCTS)
    const inventoryId = await insertPartnerInventoryShopDemoFromPg(pid, {
      sku: product.sku,
      name: product.name,
      description: product.description,
      priceAmount: product.priceAmount,
      colors: product.colors,
      sizes: product.sizes,
      mainImage: product.mainImage,
      galleryUrls: product.galleryUrls,
      detailImageUrls: product.detailImageUrls,
      material: product.material,
      materialDetailImageUrl: product.materialDetailImageUrl,
      realUseImageUrl: product.realUseImageUrl,
      realUseImageUrl2: product.realUseImageUrl2,
      consultNote: product.consultNote,
      remarketingId: product.sourceProductId,
      stockQty: product.stockQty,
      sortOrder: i + 1,
      productUrl: catalog.catalog_json.link_default,
      productVideoUrl: catalog.catalog_json.video_link,
      productStudioMeta: {
        demo: true,
        source: '188.com.vn',
        sourceSku: product.sourceSku,
        sourceProductId: product.sourceProductId,
        kind: product.kind,
      },
    })
    if (!inventoryId) {
      console.warn('[seedShopDemoInventoryForPartner] insert failed', product.sku)
      continue
    }
    await applyPartnerInventoryCatalogPatchFromPg([
      {
        id: inventoryId,
        partnerId: pid,
        catalog,
        materialNote: product.material,
      },
    ])
    inserted += 1
    const categoryId = await categoryIdForDemoProduct(pid, product)
    if (categoryId) {
      await assignInventoryToCategoryFromPg(pid, inventoryId, categoryId, true)
    }
  }

  return { ok: true, inserted, skipped }
}

/** Seed khi tạo workspace/shop mua sắm. Lỗi seed không chặn tạo shop. */
export async function maybeSeedShopDemoInventoryOnCreate(
  partnerId: string,
  industryKey: string | null | undefined
): Promise<void> {
  if (!isShoppingShopIndustry(industryKey)) return
  try {
    await seedShopDemoInventoryForPartner(partnerId)
  } catch (e) {
    console.warn('[maybeSeedShopDemoInventoryOnCreate]', e)
  }
}

/** Seed khi dựng web shop lần đầu mà kho còn trống (shop cũ tạo trước tính năng này). */
export async function maybeSeedShopDemoInventoryOnWebsiteCreate(
  partnerId: string,
  industryKey: string | null | undefined
): Promise<void> {
  if (!isShoppingShopIndustry(industryKey)) return
  try {
    await seedShopDemoInventoryForPartner(partnerId, { onlyIfEmpty: true })
  } catch (e) {
    console.warn('[maybeSeedShopDemoInventoryOnWebsiteCreate]', e)
  }
}
