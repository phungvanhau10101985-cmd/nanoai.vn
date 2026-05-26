/** Tin nhắn từ khung nhúng cha (FloatingChatWidget) → iframe `/messaging/p/...`. */
export const NANOAI_WIDGET_MSG_SOURCE = 'nanoai-widget' as const

export type NanoaiWidgetToIframeMessage =
  | { source: typeof NANOAI_WIDGET_MSG_SOURCE; type: 'OPEN_MY_ORDERS' }
  | { source: typeof NANOAI_WIDGET_MSG_SOURCE; type: 'OPEN_TRY_ON_PANEL' }
  | { source: typeof NANOAI_WIDGET_MSG_SOURCE; type: 'CLOSE_TRY_ON_PANEL' }

/** iframe chat → trang host (shop): thay thế tab đang mở bằng URL SP (cross-origin). */
export type NanoaiIframeToParentMessage = {
  source: typeof NANOAI_WIDGET_MSG_SOURCE
  type: 'NAVIGATE_TOP'
  url: string
  /** URL đầy đủ của document iframe chat — lưu trên domain shop để quay lại / mở lại đúng phiên. */
  returnChatUrl?: string
}

export function isOpenMyOrdersMessage(data: unknown): data is Extract<NanoaiWidgetToIframeMessage, { type: 'OPEN_MY_ORDERS' }> {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return o.source === NANOAI_WIDGET_MSG_SOURCE && o.type === 'OPEN_MY_ORDERS'
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

/** Chỉ cho phép http(s) — tránh javascript: trong postMessage. */
export function isAllowedHttpNavigationUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
