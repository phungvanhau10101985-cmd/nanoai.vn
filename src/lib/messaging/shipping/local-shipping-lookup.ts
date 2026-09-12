import { fetchPartnerOrderByPaymentReferenceForPartnerFromPg } from '@/lib/db/messaging-partner-orders-pg'
import {
  fetchPartnerOrderByPhoneLatestFromPg,
  findPartnerEmsRecordByTokenFromPg,
} from '@/lib/db/messaging-partner-ems-shipping-pg'
import { looksLikeEmsTrackingCode } from '@/lib/messaging/shipping/ems-excel'
import { fetchEmsTracking } from '@/lib/messaging/shipping/ems-tracking'
import { fetchPartnerOrderShipmentEventsFromPg } from '@/lib/db/messaging-partner-order-shipment-pg'

function classifyQuery(query: ShippingLookupQuery): { kind: 'order' | 'phone' | 'ems'; value: string } {
  const v = query.value.trim()
  if (query.type === 'phone') return { kind: 'phone', value: v }
  if (query.type === 'ems_code' || looksLikeEmsTrackingCode(v)) return { kind: 'ems', value: v.toUpperCase() }
  if (query.type === 'order_code') return { kind: 'order', value: v.toUpperCase() }
  const digits = v.replace(/\D/g, '')
  if (digits.length >= 9 && /^0?\d+$/.test(v.replace(/\s+/g, ''))) return { kind: 'phone', value: v }
  if (looksLikeEmsTrackingCode(v)) return { kind: 'ems', value: v.toUpperCase() }
  return { kind: 'order', value: v.toUpperCase() }
}

function statusLabel(shippingStatus: string | null | undefined): string {
  const s = (shippingStatus || 'pending').toLowerCase()
  if (s === 'shipping') return 'Đang giao'
  if (s === 'delivered') return 'Đã giao'
  if (s === 'returned') return 'Hoàn hàng'
  if (s === 'cancelled') return 'Đã hủy'
  if (s === 'packing') return 'Đang đóng gói'
  if (s === 'confirmed') return 'Đã xác nhận'
  return 'Chờ xử lý'
}

export async function lookupLocalPartnerShipping(
  partnerId: string,
  query: ShippingLookupQuery,
): Promise<PartnerShippingLookupOutcome> {
  const classified = classifyQuery(query)
  let record = await findPartnerEmsRecordByTokenFromPg(partnerId, classified.value)
  let order = classified.kind === 'order'
    ? await fetchPartnerOrderByPaymentReferenceForPartnerFromPg(partnerId, classified.value)
    : null
  if (classified.kind === 'phone') {
    const byPhone = await fetchPartnerOrderByPhoneLatestFromPg(partnerId, classified.value)
    if (byPhone?.id) {
      order = await fetchPartnerOrderByPaymentReferenceForPartnerFromPg(
        partnerId,
        String(byPhone.payment_reference || ''),
      )
      if (!record && byPhone.id) {
        record = await findPartnerEmsRecordByTokenFromPg(partnerId, String(byPhone.payment_reference || byPhone.id))
      }
    }
  }
  if (!order && record?.order_code) {
    order = await fetchPartnerOrderByPaymentReferenceForPartnerFromPg(partnerId, record.order_code)
  }
  const tracking = (record?.ems_tracking_code || record?.reference_code || order?.tracking_number || '').trim()
  let emsEvents: PartnerShippingLookupHit['emsEvents'] = []
  let emsStatus = record?.ems_status || ''
  if (tracking && looksLikeEmsTrackingCode(tracking)) {
    const live = await fetchEmsTracking(tracking)
    if (live.current_status_description) emsStatus = live.current_status_description
    emsEvents = (live.events || []).map((e) => ({
      description: e.description,
      address: e.address || '',
      tracedAt: e.traced_at || '',
    }))
  }
  if (!order && !record) {
    return { ok: false, httpStatus: 404, detail: 'Không tìm thấy đơn / vận đơn.' }
  }
  const hit: PartnerShippingLookupHit = {
    query: query.value,
    queryType: classified.kind === 'phone' ? 'phone' : classified.kind === 'ems' ? 'ems_code' : 'order_code',
    isLatestOrder: classified.kind === 'phone',
    trackingNumber: tracking,
    shippingProvider: order?.shipping_provider || (tracking ? 'EMS' : ''),
    orderCode: order?.payment_reference || record?.order_code || '',
    status: order?.shipping_status || record?.order_status || 'pending',
    statusLabel: emsStatus || statusLabel(order?.shipping_status || record?.order_status),
    paymentStatusLabel: order?.status || '',
    shippingMethod: 'EMS',
    items: order
      ? [
          {
            product_name: order.product_name,
            selected_size: order.variant_size,
            selected_color_name: order.variant_color,
            quantity: order.quantity,
            product_sku: record?.product_code || '',
          },
        ]
      : [],
    emsStatus,
    emsEvents,
    fulfillmentSource: order?.fulfillment_source || '',
    sourcePlatform: order?.source_platform || '',
    shipmentEvents: order
      ? (await fetchPartnerOrderShipmentEventsFromPg(order.id)).map((event) => ({
          stepKey: event.stepKey,
          title: event.title,
          status: event.status,
          scheduledAt: event.scheduledAt,
          completedAt: event.completedAt,
        }))
      : [],
    httpStatus: 200,
  }
  return { ok: true, hit }
}
