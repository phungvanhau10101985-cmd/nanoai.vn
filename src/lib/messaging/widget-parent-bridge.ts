/** Tin nhắn từ khung nhúng cha (FloatingChatWidget) → iframe `/messaging/p/...`. */
export const NANOAI_WIDGET_MSG_SOURCE = 'nanoai-widget' as const

export type NanoaiWidgetToIframeMessage = {
  source: typeof NANOAI_WIDGET_MSG_SOURCE
  type: 'OPEN_MY_ORDERS'
}

export function isOpenMyOrdersMessage(data: unknown): data is NanoaiWidgetToIframeMessage {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return o.source === NANOAI_WIDGET_MSG_SOURCE && o.type === 'OPEN_MY_ORDERS'
}
