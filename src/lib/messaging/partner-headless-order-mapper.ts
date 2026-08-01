import type {
  PartnerOrderLineRow,
  PartnerOrderRow,
} from '@/lib/db/messaging-partner-orders-pg'

export type HeadlessOrderSnapshot = {
  order_id: string
  status: PartnerOrderRow['status']
  shipping_status: PartnerOrderRow['shipping_status']
  subtotal_amount: number
  amount_after_discount: number
  deposit_percent: number
  required_amount: number
  paid_amount: number
  payment_reference: string
  payment_qr_url: string
  currency: string
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_address: string
  note: string
  created_at: string
  updated_at: string
  /** Chỉ có khi đơn tạo qua headless checkout (external_thread_id = headless:…) */
  customer_ref: string | null
}

export type HeadlessOrderLineSnapshot = {
  line_id: string
  product_inventory_id: string | null
  product_name: string
  product_image_url: string
  product_url: string
  unit_price: number
  quantity: number
  line_subtotal: number
  variant_color: string
  variant_size: string
  note: string
}

export type HeadlessOrderDetailSnapshot = HeadlessOrderSnapshot & {
  lines: HeadlessOrderLineSnapshot[]
}

const HEADLESS_THREAD_PREFIX = 'headless:'

export function customerRefFromExternalThreadId(externalThreadId: string): string | null {
  const t = String(externalThreadId ?? '').trim()
  if (!t.startsWith(HEADLESS_THREAD_PREFIX)) return null
  const ref = t.slice(HEADLESS_THREAD_PREFIX.length).trim()
  return ref || null
}

export function mapPartnerOrderToHeadlessSnapshot(order: PartnerOrderRow): HeadlessOrderSnapshot {
  return {
    order_id: order.id,
    status: order.status,
    shipping_status: order.shipping_status,
    subtotal_amount: order.subtotal_amount,
    amount_after_discount: order.amount_after_discount,
    deposit_percent: order.deposit_percent,
    required_amount: order.required_amount,
    paid_amount: order.paid_amount,
    payment_reference: order.payment_reference,
    payment_qr_url: order.payment_qr_url,
    currency: order.currency,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    shipping_address: order.shipping_address,
    note: order.note,
    created_at: order.created_at,
    updated_at: order.updated_at,
    customer_ref: customerRefFromExternalThreadId(order.external_thread_id),
  }
}

export function mapPartnerOrderLineToHeadlessSnapshot(
  line: PartnerOrderLineRow
): HeadlessOrderLineSnapshot {
  return {
    line_id: line.id,
    product_inventory_id: line.product_inventory_id,
    product_name: line.product_name,
    product_image_url: line.product_image_url,
    product_url: line.product_url,
    unit_price: line.unit_price,
    quantity: line.quantity,
    line_subtotal: line.line_subtotal,
    variant_color: line.variant_color,
    variant_size: line.variant_size,
    note: line.note,
  }
}

export function mapPartnerOrderDetailToHeadless(
  order: PartnerOrderRow,
  lines: PartnerOrderLineRow[]
): HeadlessOrderDetailSnapshot {
  return {
    ...mapPartnerOrderToHeadlessSnapshot(order),
    lines: lines.map(mapPartnerOrderLineToHeadlessSnapshot),
  }
}

export const HEADLESS_ORDER_STATUS_VALUES = [
  'awaiting_payment',
  'payment_checking',
  'paid_verified',
  'pending_manual_review',
  'cancelled',
] as const satisfies readonly PartnerOrderRow['status'][]

export type HeadlessOrderStatusFilter = (typeof HEADLESS_ORDER_STATUS_VALUES)[number]

export function parseHeadlessOrderStatusFilter(raw: string | null): HeadlessOrderStatusFilter | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  return (HEADLESS_ORDER_STATUS_VALUES as readonly string[]).includes(t)
    ? (t as HeadlessOrderStatusFilter)
    : null
}
