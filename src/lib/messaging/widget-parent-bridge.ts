/** Tin nhắn từ khung nhúng cha (FloatingChatWidget) → iframe `/messaging/p/...`. */
export const NANOAI_WIDGET_MSG_SOURCE = 'nanoai-widget' as const

export type NanoaiWidgetPageContextPayload = {
  imageUrl?: string
  imageUrl2?: string
  sku?: string
  inventoryId?: string
  productUrl?: string
  openTryOn?: boolean
  /** Origin+path trang host khi nhúng — phân nhánh giỏ SaaS vs web khách. */
  embedPage?: string
}

export type NanoaiWidgetToIframeMessage =
  | { source: typeof NANOAI_WIDGET_MSG_SOURCE; type: 'OPEN_MY_ORDERS' }
  | { source: typeof NANOAI_WIDGET_MSG_SOURCE; type: 'OPEN_TRY_ON_PANEL' }
  | { source: typeof NANOAI_WIDGET_MSG_SOURCE; type: 'CLOSE_TRY_ON_PANEL' }
  | ({ source: typeof NANOAI_WIDGET_MSG_SOURCE; type: 'SET_PAGE_CONTEXT' } & NanoaiWidgetPageContextPayload)

/** iframe chat → trang host (shop): thay thế tab đang mở bằng URL SP (cross-origin). */
export type NanoaiIframeToParentMessage = {
  source: typeof NANOAI_WIDGET_MSG_SOURCE
  type: 'NAVIGATE_TOP'
  url: string
  /** URL đầy đủ của document iframe chat — lưu trên domain shop để quay lại / mở lại đúng phiên. */
  returnChatUrl?: string
}

/** Iframe chat → shop NanoAI: đơn vừa tạo/cập nhật, tải lại trang đơn cùng tài khoản. */
export type NanoaiIframeOrderUpdatedMessage = {
  source: typeof NANOAI_WIDGET_MSG_SOURCE
  type: 'ORDER_UPDATED'
  siteSlug?: string
}

export const PARTNER_SITE_ORDERS_UPDATED_EVENT = 'pw-partner-site-orders-updated'

export function isOpenMyOrdersMessage(data: unknown): data is Extract<NanoaiWidgetToIframeMessage, { type: 'OPEN_MY_ORDERS' }> {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return o.source === NANOAI_WIDGET_MSG_SOURCE && o.type === 'OPEN_MY_ORDERS'
}

export function parseWidgetPageContextFromChatUrl(urlStr: string, baseHref?: string): NanoaiWidgetPageContextPayload {
  try {
    const u = new URL(urlStr, baseHref || 'https://localhost')
    const imageUrl = (u.searchParams.get('ctx_image') || '').trim()
    const imageUrl2 = (u.searchParams.get('ctx_image_2') || '').trim()
    const sku = (u.searchParams.get('ctx_sku') || '').trim()
    const inventoryId = (u.searchParams.get('ctx_inventory') || '').trim()
    const productUrl = (u.searchParams.get('ctx_product_url') || '').trim()
    const tryOn =
      (u.searchParams.get('open_try_on') || '').trim() === '1' ||
      (u.searchParams.get('ctx_gateway') || '').trim().toLowerCase() === 'try_on'
    const embedPage = (u.searchParams.get('embed_page') || '').trim()
    return {
      ...(imageUrl ? { imageUrl } : {}),
      ...(imageUrl2 ? { imageUrl2 } : {}),
      ...(sku ? { sku } : {}),
      ...(inventoryId ? { inventoryId } : {}),
      ...(productUrl ? { productUrl } : {}),
      ...(tryOn ? { openTryOn: true } : {}),
      ...(embedPage ? { embedPage } : {}),
    }
  } catch {
    return {}
  }
}

export function isSetPageContextMessage(
  data: unknown
): data is Extract<NanoaiWidgetToIframeMessage, { type: 'SET_PAGE_CONTEXT' }> {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return o.source === NANOAI_WIDGET_MSG_SOURCE && o.type === 'SET_PAGE_CONTEXT'
}

export function isWidgetTryOnPanelMessage(
  data: unknown
): data is Extract<NanoaiWidgetToIframeMessage, { type: 'OPEN_TRY_ON_PANEL' | 'CLOSE_TRY_ON_PANEL' }> {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return (
    o.source === NANOAI_WIDGET_MSG_SOURCE &&
    (o.type === 'OPEN_TRY_ON_PANEL' || o.type === 'CLOSE_TRY_ON_PANEL')
  )
}

export function isNavigateTopFromIframe(data: unknown): data is NanoaiIframeToParentMessage {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return (
    o.source === NANOAI_WIDGET_MSG_SOURCE &&
    o.type === 'NAVIGATE_TOP' &&
    typeof o.url === 'string' &&
    o.url.trim().length > 0
  )
}

export function isOrderUpdatedFromIframe(data: unknown): data is NanoaiIframeOrderUpdatedMessage {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return (
    o.source === NANOAI_WIDGET_MSG_SOURCE &&
    o.type === 'ORDER_UPDATED' &&
    (o.siteSlug == null || typeof o.siteSlug === 'string')
  )
}

/** Chỉ cho phép http(s) — tránh javascript: trong postMessage. */
export function isAllowedHttpNavigationUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Chat không được kéo cả tab shop sang trang quản trị. */
export function isDashboardNavigationUrl(url: string): boolean {
  try {
    const path = new URL(url.trim()).pathname.replace(/\/+$/, '') || '/'
    return path === '/dashboard' || path.startsWith('/dashboard/')
  } catch {
    return false
  }
}
