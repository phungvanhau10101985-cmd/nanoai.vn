import type { MessagingPartnerInventoryRow } from '@/lib/db/messaging-partner-inventory-pg'
import { parseColorVariantsJson } from '@/lib/messaging/inventory-color-variants'
import {
  collectShopProductDetailImages,
  collectShopProductGalleryImages,
  inventoryShopDetailDescription,
  inventoryShopProductVideoUrl,
} from '@/lib/partner-website/shop/inventory-shop-detail'
import { inventoryShopDisplayDescription } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export type PartnerCatalogProduct = {
  inventory_id: string
  sku: string | null
  name: string
  price_hint: string
  short_description: string
  detail_description: string
  image_url: string
  product_url: string
  product_video_url: string | null
  gallery_images: string[]
  detail_images: string[]
  sizes: string[]
  colors: Array<{ name: string; img: string }>
  stock_qty: number
  sort_order: number
  remarketing_id: string | null
  shop_ready: boolean
  /** Đường dẫn tương đối trên NanoAI khi site đã publish, vd /site/{slug}/products/{id} */
  nanoai_site_path: string | null
}

function parseInventorySizeJson(raw: string): string[] {
  const t = String(raw ?? '').trim()
  if (!t || t[0] !== '[') return []
  try {
    const arr = JSON.parse(t) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean)
      .slice(0, 50)
  } catch {
    return []
  }
}

function isShopReadyRow(row: MessagingPartnerInventoryRow): boolean {
  const imageUrl = (row.image_url ?? '').trim()
  const productUrl = (row.product_url ?? '').trim()
  return /^https?:\/\//i.test(imageUrl) && /^https?:\/\//i.test(productUrl)
}

export function mapInventoryRowToPartnerCatalogProduct(
  row: MessagingPartnerInventoryRow,
  ctx: { publishedSiteSlug: string | null }
): PartnerCatalogProduct {
  const shopReady = isShopReadyRow(row)
  const siteSlug = ctx.publishedSiteSlug?.trim() || null
  return {
    inventory_id: row.id,
    sku: (row.sku ?? '').trim() || null,
    name: (row.name ?? '').trim() || 'Product',
    price_hint: (row.price_hint ?? '').trim(),
    short_description: inventoryShopDisplayDescription(row),
    detail_description: inventoryShopDetailDescription(row),
    image_url: (row.image_url ?? '').trim(),
    product_url: (row.product_url ?? '').trim(),
    product_video_url: inventoryShopProductVideoUrl(row),
    gallery_images: collectShopProductGalleryImages(row),
    detail_images: collectShopProductDetailImages(row),
    sizes: Array.isArray(row.sizes_json) && row.sizes_json.length
      ? row.sizes_json.map((x) => String(x ?? '').trim()).filter(Boolean)
      : parseInventorySizeJson(row.description ?? ''),
    colors:
      Array.isArray(row.colors_json) && row.colors_json.length
        ? row.colors_json.map((c) => ({ name: c.name, img: c.img }))
        : parseColorVariantsJson(row.stock_note ?? ''),
    stock_qty: Math.max(0, Math.floor(Number(row.stock_qty ?? 0) || 0)),
    sort_order: Math.floor(Number(row.sort_order ?? 0) || 0),
    remarketing_id: (row.remarketing_id ?? '').trim() || null,
    shop_ready: shopReady,
    nanoai_site_path:
      shopReady && siteSlug
        ? partnerSiteProductPath(siteSlug, row.id, { name: (row.name ?? '').trim() || 'Product' })
        : null,
  }
}
