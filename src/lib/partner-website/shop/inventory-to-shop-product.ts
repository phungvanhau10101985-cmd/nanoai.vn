import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { parseColorVariantsJson } from '@/lib/messaging/inventory-color-variants'
import {
  collectShopProductDetailImages,
  collectShopProductGalleryImages,
  inventoryShopDetailDescription,
  inventoryShopProductVideoUrl,
  type InventoryShopSourceRow,
} from '@/lib/partner-website/shop/inventory-shop-detail'
import { parseInventorySizesForFacet } from '@/lib/partner-website/shop/partner-shop-industry-facets'
import type { LivePdpBindColor } from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
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
  /** Tồn kho hiện tại — chỉ dùng để hiển thị cảnh báo "sắp hết hàng" (W1.6), KHÔNG dùng để chặn mua
   * (nhiều shop chưa từng nhập số liệu này nên mặc định 0 — chặn mua theo giá trị này sẽ hỏng
   * checkout hàng loạt cho shop chưa cấu hình tồn kho, xem partner-site-shop-product-client.tsx). */
  stockQty: number
  /** W4.10 / W1.4 — optional on mock/SSR stubs */
  priceAmount?: number | null
  priceCurrency?: string
  salePriceAmount?: number | null
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  /** W1.5 — resolved from primary category when available. */
  sizeGuideImageUrl?: string | null
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
  row: InventoryShopSourceRow & {
    id: string
    name?: string | null
    price_hint?: string | null
    sku?: string | null
    product_url?: string | null
    stock_qty?: number | null
    price_amount?: number | null
    price_currency?: string | null
    sale_price_amount?: number | null
    sale_starts_at?: string | null
    sale_ends_at?: string | null
    sizeGuideImageUrl?: string | null
  }
): PartnerSiteShopProduct | null {
  const name = (row.name ?? '').trim() || 'Product'
  const detailPath = partnerSiteProductPath(siteSlug, row.id, { name })
  const galleryImages = collectShopProductGalleryImages(row)
  const rawImage =
    (row.image_url ?? '').trim() ||
    galleryImages[0]?.trim() ||
    ''
  // Prefer real https image; otherwise keep a visible placeholder so catalog is not empty.
  const imageUrl = /^https?:\/\//i.test(rawImage)
    ? rawImage
    : `https://placehold.co/600x600/f1f5f9/64748b?text=${encodeURIComponent(name.slice(0, 18))}`
  const rawProductUrl = (row.product_url ?? '').trim()
  // Chat inventory often omits product_url — shop detail path is enough.
  const productUrl = /^https?:\/\//i.test(rawProductUrl)
    ? rawProductUrl
    : `https://shop.local${detailPath}`
  return {
    id: row.id,
    name,
    description: inventoryShopDisplayDescription(row),
    detailDescription: inventoryShopDetailDescription(row),
    galleryImages: galleryImages.length
      ? galleryImages
      : /^https?:\/\//i.test(rawImage)
        ? [rawImage]
        : [imageUrl],
    detailImages: collectShopProductDetailImages(row),
    productVideoUrl: inventoryShopProductVideoUrl(row),
    priceHint: (row.price_hint ?? '').trim(),
    imageUrl,
    productUrl,
    sku: (row.sku ?? '').trim(),
    detailPath,
    stockQty: Math.max(0, Math.round(Number(row.stock_qty ?? 0)) || 0),
    priceAmount: row.price_amount != null && Number.isFinite(Number(row.price_amount)) ? Number(row.price_amount) : null,
    priceCurrency: String(row.price_currency ?? 'VND').trim() || 'VND',
    salePriceAmount:
      row.sale_price_amount != null && Number.isFinite(Number(row.sale_price_amount))
        ? Number(row.sale_price_amount)
        : null,
    saleStartsAt: row.sale_starts_at ? String(row.sale_starts_at) : null,
    saleEndsAt: row.sale_ends_at ? String(row.sale_ends_at) : null,
    sizeGuideImageUrl: row.sizeGuideImageUrl?.trim() || null,
  }
}

/** Size/color for visual PDP bind — same source as GET .../options. */
export function inventoryRowToLivePdpVariants(row: {
  description?: string | null
  stock_note?: string | null
  sizes_json?: unknown
  colors_json?: unknown
}): { sizes: string[]; colors: LivePdpBindColor[] } {
  const sizes = parseInventorySizesForFacet(
    row.description,
    Array.isArray(row.sizes_json)
      ? row.sizes_json.map((x) => String(x ?? '').trim()).filter(Boolean)
      : null
  )
  const structured = Array.isArray(row.colors_json)
    ? row.colors_json
        .map((item) => {
          const c = item as { name?: string; img?: string } | null
          return {
            name: String(c?.name || '').trim(),
            img: String(c?.img || '').trim() || null,
          }
        })
        .filter((c) => c.name)
    : []
  return {
    sizes,
    colors: structured.length ? structured : parseColorVariantsJson(row.stock_note ?? ''),
  }
}

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
  if (!/^https?:\/\//i.test(image_url)) return null
  const rawProductUrl = (row.product_url ?? '').trim()
  const product_url = /^https?:\/\//i.test(rawProductUrl)
    ? rawProductUrl
    : `https://shop.local/inventory/${encodeURIComponent(row.id)}`
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
