import { placeImportedInventoryInCategoryTreeBatch } from '@/lib/partner-website/category/partner-category-place-product'

/**
 * Gán SP import đủ cột (41 cột / Open Catalog / sync) vào cây danh mục shop:
 * có rồi thì thêm, chưa có thì tạo L1/L2/L3, không trùng ý định SEO, sinh SEO trang bằng Gemini.
 * AI không sinh được → trả lỗi, dừng. Excel 12 cột không đi qua đây.
 */
export async function linkImportedInventoryToCatalogCategories(input: {
  partnerId: string
  inventoryId: string
  categoryL1?: string | null
  categoryL2?: string | null
  categoryL3?: string | null
  productName?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return linkImportedInventoryToCatalogCategoriesBatch(input.partnerId, [input])
}

/** Một lần đọc cây danh mục, rồi gán nhiều SP — dùng khi đồng bộ kho khách số lớn. */
export async function linkImportedInventoryToCatalogCategoriesBatch(
  partnerId: string,
  items: Array<{
    inventoryId: string
    categoryL1?: string | null
    categoryL2?: string | null
    categoryL3?: string | null
    productName?: string
  }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  return placeImportedInventoryInCategoryTreeBatch(partnerId, items)
}
