/**
 * Sự kiện chuẩn Meta cho quảng cáo catalog / tiếp thị lại động.
 * `content_ids` trùng cột id feed Facebook (`feature_*`).
 */
export const NANOAI_FACEBOOK_DYNAMIC_EVENTS = [
  'ViewContent',
  'Search',
  'AddToCart',
  'AddToWishlist',
  'InitiateCheckout',
  'AddPaymentInfo',
  'Purchase',
] as const

export type NanoAiFacebookDynamicEvent = (typeof NANOAI_FACEBOOK_DYNAMIC_EVENTS)[number]

export type NanoAiFacebookDynamicCustomData = {
  content_ids: string[]
  content_type: 'product'
  content_name: string
  content_category: string
  currency: 'VND'
  value: number
  num_items: number
  contents: Array<{ id: string; quantity: number; item_price: number }>
  search_string?: string
  order_id?: string
}

const SEARCH_MAX = 100

export function sanitizeNanoAiFacebookSearchString(raw: string): string {
  return String(raw || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SEARCH_MAX)
}

export function buildNanoAiFacebookDynamicCustomData(input: {
  contentId: string
  contentName: string
  valueVnd: number
  searchString?: string
  orderId?: string
  quantity?: number
  category?: string
}): NanoAiFacebookDynamicCustomData {
  const contentId = String(input.contentId || '').trim().slice(0, 50)
  const quantity = Math.max(1, Math.min(99, Math.floor(input.quantity ?? 1) || 1))
  const value = Math.max(0, Math.round(input.valueVnd))
  const name = String(input.contentName || '').trim().slice(0, 200) || contentId || 'search'
  const data: NanoAiFacebookDynamicCustomData = {
    content_ids: contentId ? [contentId] : [],
    content_type: 'product',
    content_name: name,
    content_category: String(input.category || 'ai_feature').trim().slice(0, 100) || 'ai_feature',
    currency: 'VND',
    value,
    num_items: contentId ? quantity : 0,
    contents: contentId ? [{ id: contentId, quantity, item_price: value }] : [],
  }
  const search = sanitizeNanoAiFacebookSearchString(input.searchString || '')
  if (search) data.search_string = search
  const orderId = String(input.orderId || '').trim().slice(0, 80)
  if (orderId) data.order_id = orderId
  return data
}

/** Trang có `q` hoặc `query` thì bắn Search. Không lấy tham số khác. */
export function readNanoAiFacebookSearchString(search: string): string {
  const raw = String(search || '').trim()
  if (!raw) return ''
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  return sanitizeNanoAiFacebookSearchString(params.get('q') || params.get('query') || '')
}
