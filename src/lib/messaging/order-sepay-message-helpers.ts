import type { Json } from '@/types/database.types'

/**
 * Các `order_id` đã có tin hệ thống từ webhook SePay (đối chiếu giao dịch — không cần gửi thêm biên lai ảnh).
 */
export function collectSepayWebhookConfirmedOrderIds(
  messages: ReadonlyArray<{ raw_payload?: Json | null }>
): Set<string> {
  const ids = new Set<string>()
  for (const m of messages) {
    const raw = m.raw_payload
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const o = raw as Record<string, unknown>
    if (o.source !== 'system_order') continue
    if (o.payment_webhook_source !== 'sepay') continue
    const oid = typeof o.order_id === 'string' ? o.order_id.trim() : ''
    if (oid) ids.add(oid)
  }
  return ids
}
