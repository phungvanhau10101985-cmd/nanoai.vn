import { colorImageUrlsForInventorySearch } from '@/lib/messaging/inventory-extra-image-urls'
import { parseColorVariantsJson } from '@/lib/messaging/inventory-color-variants'

export type InventoryShopSourceRow = {
  image_url?: string | null
  stock_note?: string | null
  material_note?: string | null
  consult_note?: string | null
  material_detail_image_url?: string | null
  real_use_image_url?: string | null
  real_use_image_url_2?: string | null
  product_video_url?: string | null
  /** PS.1 — ảnh phụ bổ sung (Product Studio / upload nhiều ảnh) — nối THÊM, không thay thế nguồn cũ. */
  gallery_urls?: string[] | null
  /** PS.1 — ảnh chi tiết/chất liệu do Product Studio sinh — nối THÊM vào ảnh chi tiết hiện có. */
  detail_image_urls?: string[] | null
}

function isHttpsUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw.trim())
}

/** Mô tả chi tiết hiển thị trên shop PDP (ưu tiên material_note). */
export function inventoryShopDetailDescription(row: {
  material_note?: string | null
  consult_note?: string | null
}): string {
  const material = (row.material_note ?? '').trim()
  if (material) return material
  return (row.consult_note ?? '').trim()
}

/** Gallery ảnh shop: ảnh chính → màu → ảnh chi tiết / thực tế. */
export function collectShopProductGalleryImages(row: InventoryShopSourceRow): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: string) => {
    const url = raw.trim()
    if (!isHttpsUrl(url) || seen.has(url)) return
    seen.add(url)
    out.push(url)
  }

  push(row.image_url ?? '')
  for (const c of parseColorVariantsJson(row.stock_note ?? '')) {
    push(c.img)
  }
  for (const url of colorImageUrlsForInventorySearch(
    row.image_url ?? '',
    row.material_detail_image_url ?? '',
    row.real_use_image_url ?? '',
    row.real_use_image_url_2 ?? ''
  )) {
    push(url)
  }
  // PS.1 — ảnh phụ Product Studio (studio slots hoặc upload nhiều ảnh thủ công), nối thêm cuối.
  for (const url of row.gallery_urls ?? []) push(url)
  for (const url of row.detail_image_urls ?? []) push(url)

  return out
}

/** Ảnh chi tiết / lifestyle (không gồm ảnh chính). */
export function collectShopProductDetailImages(row: InventoryShopSourceRow): string[] {
  const main = (row.image_url ?? '').trim()
  return collectShopProductGalleryImages(row).filter((url) => url !== main)
}

export function inventoryShopProductVideoUrl(row: { product_video_url?: string | null }): string | null {
  const url = (row.product_video_url ?? '').trim()
  return isHttpsUrl(url) ? url : null
}
