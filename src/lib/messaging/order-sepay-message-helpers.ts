import type { Json } from '@/types/database.types'

const PAID_LIKE_STATUS = new Set(['paid_verified', 'pending_manual_review', 'payment_checking'])

/**
 * Từ tin hệ thống trong chat: đơn đã đặt cọc / đang đối chiếu (SePay webhook, OCR biên lai, v.v.).
 * Tin checkout cũ vẫn lưu `order_status: awaiting_payment` — dùng tập này để ẩn QR trên tin đó.
 */
export function collectGuestOrderDepositConfirmationSplit(
  messages: ReadonlyArray<{ raw_payload?: Json | null }>
): { paidDepositOrderIds: Set<string>; sepayWebhookOrderIds: Set<string> } {
  const paidDepositOrderIds = new Set<string>()
  const sepayWebhookOrderIds = new Set<string>()
  for (const m of messages) {
    const raw = m.raw_payload
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const o = raw as Record<string, unknown>
    if (o.source !== 'system_order') continue
    const oid = typeof o.order_id === 'string' ? o.order_id.trim() : ''
    if (!oid) continue
    if (o.payment_webhook_source === 'sepay') {
      sepayWebhookOrderIds.add(oid)
      paidDepositOrderIds.add(oid)
      continue
    }
    const st = typeof o.order_status === 'string' ? o.order_status.trim() : ''
    if (st && PAID_LIKE_STATUS.has(st)) {
      paidDepositOrderIds.add(oid)
    }
  }
  return { paidDepositOrderIds, sepayWebhookOrderIds }
}
