import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import {
  collectShopProductDetailImages,
  collectShopProductGalleryImages,
  inventoryShopDetailDescription,
  inventoryShopProductVideoUrl,
  type InventoryShopSourceRow,
} from '@/lib/partner-website/shop/inventory-shop-detail'
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export type PartnerSiteShopProduct = {
  id: string
  name: string
  description: string
  detailDescription: string
  galleryImages: string[]
  detailImages: string[]
  productVideoUrl: string | null
  priceHint: string
  imageUrl: string
  productUrl: string
  sku: string
  detailPath: string
}
/** Mô tả hiển thị shop — bỏ qua cột JSON size/màu (description / stock_note). */
export function inventoryShopDisplayDescription(row: {
  description?: string | null
  stock_note?: string | null
  consult_note?: string | null
}): string {
  const consult = (row.consult_note ?? '').trim()
  const desc = (row.description ?? '').trim()
  const stock = (row.stock_note ?? '').trim()
  if (desc && !desc.startsWith('[')) return desc
  if (consult) return consult
  if (stock && !stock.startsWith('[')) return stock
  return ''
}

export function inventoryRowToShopProduct(
  siteSlug: string,
  row: InventoryShopSourceRow & { id: string; name?: string | null; price_hint?: string | null; sku?: string | null; product_url?: string | null }
): PartnerSiteShopProduct | null {
  const name = (row.name ?? '').trim() || 'Product'
  const imageUrl = (row.image_url ?? '').trim()
  const productUrl = (row.product_url ?? '').trim()
  if (!/^https?:\/\//i.test(imageUrl) || !/^https?:\/\//i.test(productUrl)) return null
  const galleryImages = collectShopProductGalleryImages(row)
  return {
    id: row.id,
    name,
    description: inventoryShopDisplayDescription(row),
    detailDescription: inventoryShopDetailDescription(row),
    galleryImages: galleryImages.length ? galleryImages : [imageUrl],
    detailImages: collectShopProductDetailImages(row),
    productVideoUrl: inventoryShopProductVideoUrl(row),
    priceHint: (row.price_hint ?? '').trim(),
    imageUrl,
    productUrl,
    sku: (row.sku ?? '').trim(),
    detailPath: partnerSiteProductPath(siteSlug, row.id),
  }}

export function shopProductToCartCard(product: PartnerSiteShopProduct): PartnerAiProductCard {
  const card: PartnerAiProductCard = {
    name: product.name,
    image_url: product.imageUrl,
    product_url: product.productUrl,
    inventory_id: product.id,
  }
  if (product.priceHint) card.price_hint = product.priceHint
  if (product.sku) card.sku = product.sku
  return card
}

export function inventoryRowToCartCard(
  row: InventoryShopSourceRow & { id: string; name?: string | null; price_hint?: string | null; sku?: string | null; product_url?: string | null }
): PartnerAiProductCard | null {
  const name = (row.name ?? '').trim() || 'Product'
  const image_url = (row.image_url ?? '').trim()
  const product_url = (row.product_url ?? '').trim()
  if (!/^https?:\/\//i.test(image_url) || !/^https?:\/\//i.test(product_url)) return null
  const card: PartnerAiProductCard = {
    name,
    image_url,
    product_url,
    inventory_id: row.id,
  }
  const ph = (row.price_hint ?? '').trim()
  if (ph) card.price_hint = ph
  const sku = (row.sku ?? '').trim()
  if (sku) card.sku = sku.slice(0, 128)
  return card
}
