import { toNanoAiFeatureCatalogIdFromHref } from '@/lib/catalog/nanoai-feature-catalog-id'
import {
  WEDDING_GUEST_PACKS,
  weddingGuestPackById,
  type WeddingGuestPackId,
} from '@/lib/wedding/wedding-guest-pack'

/** Cùng id feed Facebook catalog (`feature_tao_thiep_moi_cuoi_ai`). */
export const WEDDING_COMMERCE_PATH = '/tao-thiep-moi-cuoi-ai'
export const WEDDING_COMMERCE_CONTENT_ID = toNanoAiFeatureCatalogIdFromHref(WEDDING_COMMERCE_PATH)
export const WEDDING_COMMERCE_CONTENT_NAME = 'Tạo thiệp cưới AI'
export const WEDDING_COMMERCE_CATEGORY = 'wedding_invitation'

/** Giá niêm yết mặc định khi xem thiệp và khi bấm Lưu và xuất bản. */
export const WEDDING_ADD_TO_CART_VALUE_VND = 149_000

export type WeddingCommerceEventName = 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase'

export type WeddingCommerceCustomData = {
  content_ids: string[]
  content_name: string
  content_type: 'product'
  content_category: string
  currency: 'VND'
  value: number
  num_items: number
  contents: Array<{ id: string; quantity: number; item_price: number }>
  order_id?: string
  pack_id?: WeddingGuestPackId
  list_price?: number
  content_card_id?: string
}

function commercePayload(valueVnd: number, contentName: string): WeddingCommerceCustomData {
  const value = Math.max(0, Math.round(valueVnd))
  return {
    content_ids: [WEDDING_COMMERCE_CONTENT_ID],
    content_name: contentName.slice(0, 200),
    content_type: 'product',
    content_category: WEDDING_COMMERCE_CATEGORY,
    currency: 'VND',
    value,
    num_items: 1,
    contents: [{ id: WEDDING_COMMERCE_CONTENT_ID, quantity: 1, item_price: value }],
  }
}

export function weddingViewContentCustomData(): WeddingCommerceCustomData {
  return commercePayload(WEDDING_ADD_TO_CART_VALUE_VND, WEDDING_COMMERCE_CONTENT_NAME)
}

export function weddingAddToCartCustomData(cardId?: string): WeddingCommerceCustomData {
  const payload = commercePayload(WEDDING_ADD_TO_CART_VALUE_VND, WEDDING_COMMERCE_CONTENT_NAME)
  const id = String(cardId || '').trim()
  if (id) payload.content_card_id = id.slice(0, 80)
  return payload
}

export function weddingPackPaymentCustomData(input: {
  packId: WeddingGuestPackId
  amountVnd: number
  paymentId: string
}): WeddingCommerceCustomData {
  const pack = weddingGuestPackById(input.packId)
  const payload = commercePayload(input.amountVnd, pack.label)
  const paymentId = String(input.paymentId || '').trim()
  if (paymentId) payload.order_id = paymentId.slice(0, 80)
  payload.pack_id = pack.id
  payload.list_price = pack.priceVnd
  return payload
}

/** Cùng eventID pixel + CAPI, ổn định theo giao dịch QR. */
export function weddingPurchaseEventId(paymentId: string): string {
  const id = String(paymentId || '')
    .trim()
    .replace(/[^A-Za-z0-9._:-]/g, '')
    .slice(0, 80)
  return `Purchase_${id || 'wedding'}`
}

export function buildWeddingCommerceProductJsonLd(url: string, description: string): Record<string, unknown> {
  const low = WEDDING_GUEST_PACKS[0]?.priceVnd ?? WEDDING_ADD_TO_CART_VALUE_VND
  const high = WEDDING_GUEST_PACKS[WEDDING_GUEST_PACKS.length - 1]?.priceVnd ?? low
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: WEDDING_COMMERCE_CONTENT_NAME,
    description,
    sku: WEDDING_COMMERCE_CONTENT_ID,
    brand: { '@type': 'Brand', name: 'NanoAI' },
    url,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'VND',
      lowPrice: low,
      highPrice: high,
      offerCount: WEDDING_GUEST_PACKS.length,
      availability: 'https://schema.org/InStock',
      offers: WEDDING_GUEST_PACKS.map((pack) => ({
        '@type': 'Offer',
        name: pack.label,
        price: pack.priceVnd,
        priceCurrency: 'VND',
        availability: 'https://schema.org/InStock',
        url,
      })),
    },
  }
}
