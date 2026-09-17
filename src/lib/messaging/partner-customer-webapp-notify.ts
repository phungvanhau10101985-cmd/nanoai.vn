import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { notifyPartnerCustomerOrderUpdateFromPg } from '@/lib/db/messaging-partner-customer-notifications-pg'
import { fetchConversationUiLocaleFromPg } from '@/lib/db/customer-care-pg'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { partnerShopEmailBrandName } from '@/lib/messaging/partner-shop-email-brand'
import {
  EMS_PHASE_RANK,
  emsPhaseInAppLabel,
  formatCustomerInAppCopy,
  type CustomerInAppEvent,
} from '@/lib/messaging/partner-customer-inapp-copy'
import { partnerAdminAmountDueOnDelivery } from '@/lib/messaging/partner-admin-orders-lifecycle'
import { DEFAULT_WEB_LOCALE, normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'

function toVnd(n: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(n || 0)))}đ`
}

function orderCode(order: Pick<PartnerOrderRow, 'payment_reference' | 'id'>): string {
  return String(order.payment_reference || '').trim() || order.id.slice(0, 8)
}

async function shopNameForPartner(partnerId: string): Promise<string> {
  const rows = await fetchMessagingPartnersByIdsFromPg([partnerId])
  return partnerShopEmailBrandName(rows?.[0]) || 'Shop'
}

async function localeForOrder(order: PartnerOrderRow, fallback?: string | null): Promise<WebLocale> {
  const fromArg = normalizeWebLocale(fallback ?? '')
  if (fromArg) return fromArg
  const convId = String(order.conversation_id || '').trim()
  if (!convId) return DEFAULT_WEB_LOCALE
  try {
    const raw = await fetchConversationUiLocaleFromPg(convId)
    return normalizeWebLocale(raw ?? '') ?? DEFAULT_WEB_LOCALE
  } catch {
    return DEFAULT_WEB_LOCALE
  }
}

/** In-app + Web Push giống 188 `create_notification` (await push, không cắt email). */
export async function notifyPartnerCustomerWebApp(input: {
  partnerId: string
  conversationId?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  orderId?: string | null
  event: CustomerInAppEvent
  locale?: string | null
  type?: string
}): Promise<void> {
  const copy = formatCustomerInAppCopy(input.locale, input.event)
  await notifyPartnerCustomerOrderUpdateFromPg({
    partnerId: input.partnerId,
    conversationId: input.conversationId,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    orderId: input.orderId,
    title: copy.title,
    body: copy.body,
    type: input.type ?? 'order',
    awaitPush: true,
  })
}

export async function notifyPartnerCustomerOrderWebApp(input: {
  order: PartnerOrderRow
  event: Exclude<CustomerInAppEvent, { kind: 'promo_grant' }>
  locale?: string | null
}): Promise<void> {
  const locale = await localeForOrder(input.order, input.locale)
  await notifyPartnerCustomerWebApp({
    partnerId: input.order.partner_id,
    conversationId: input.order.conversation_id,
    customerEmail: input.order.customer_email,
    customerPhone: input.order.customer_phone,
    orderId: input.order.id,
    event: input.event,
    locale,
  })
}

export async function notifyPartnerCustomerOrderPlacedWebApp(
  order: PartnerOrderRow,
  locale?: string | null
): Promise<void> {
  const shopName = await shopNameForPartner(order.partner_id)
  await notifyPartnerCustomerOrderWebApp({
    order,
    locale,
    event: {
      kind: 'order_placed',
      orderCode: orderCode(order),
      shopName,
      productName: order.product_name || undefined,
      needsDeposit: (order.required_amount || 0) > 0,
      depositLabel: (order.required_amount || 0) > 0 ? toVnd(order.required_amount) : undefined,
    },
  })
}

export async function notifyPartnerCustomerDepositConfirmedWebApp(
  order: PartnerOrderRow,
  locale?: string | null
): Promise<void> {
  await notifyPartnerCustomerOrderWebApp({
    order,
    locale,
    event: {
      kind: 'deposit_confirmed',
      orderCode: orderCode(order),
      paidLabel: toVnd(order.paid_amount || 0),
      remaining: partnerAdminAmountDueOnDelivery(order),
      remainingLabel: toVnd(partnerAdminAmountDueOnDelivery(order)),
    },
  })
}

export async function notifyPartnerCustomerCancelledWebApp(
  order: PartnerOrderRow,
  opts?: { locale?: string | null; byCustomer?: boolean }
): Promise<void> {
  await notifyPartnerCustomerOrderWebApp({
    order,
    locale: opts?.locale,
    event: { kind: 'cancelled', orderCode: orderCode(order), byCustomer: opts?.byCustomer },
  })
}

export async function notifyPartnerCustomerProofReceivedWebApp(
  order: PartnerOrderRow,
  locale?: string | null
): Promise<void> {
  await notifyPartnerCustomerOrderWebApp({
    order,
    locale,
    event: { kind: 'proof_received', orderCode: orderCode(order) },
  })
}

export async function notifyPartnerCustomerRefundedWebApp(
  order: PartnerOrderRow,
  amountLabel: string,
  locale?: string | null
): Promise<void> {
  await notifyPartnerCustomerOrderWebApp({
    order,
    locale,
    event: { kind: 'refunded', orderCode: orderCode(order), amountLabel },
  })
}

export async function notifyPartnerCustomerShipperWebApp(
  order: PartnerOrderRow,
  locale?: string | null
): Promise<void> {
  const shopName = await shopNameForPartner(order.partner_id)
  await notifyPartnerCustomerOrderWebApp({
    order,
    locale,
    event: {
      kind: 'shipper_confirmed',
      orderCode: orderCode(order),
      shopName,
      tracking: order.tracking_number || undefined,
    },
  })
}

export async function notifyPartnerCustomerDeliveredWebApp(
  order: PartnerOrderRow,
  source: 'ems_auto' | 'customer_confirm',
  locale?: string | null
): Promise<void> {
  const shopName = await shopNameForPartner(order.partner_id)
  await notifyPartnerCustomerOrderWebApp({
    order,
    locale,
    event: {
      kind: source === 'ems_auto' ? 'delivered_ems' : 'delivered_customer',
      orderCode: orderCode(order),
      shopName,
    },
  })
}

type EmsNotifySnapshot = {
  shippingStatus?: string | null
  trackingNumber?: string | null
  emsPhase?: string | null
  emsStatus?: string | null
}

function normPhase(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase() || 'unknown'
}

function phaseRank(phase: string): number {
  return EMS_PHASE_RANK[phase] ?? 0
}

/** Cùng chọn sự kiện như 188 `ems_shipment_notify._resolve_notification`. */
export function pickPartnerCustomerEmsNotifyEvent(input: {
  orderCode: string
  before: EmsNotifySnapshot
  after: EmsNotifySnapshot
}): CustomerInAppEvent | null {
  const code = input.orderCode.trim() || 'order'
  const tracking = String(input.after.trackingNumber || '').trim().toUpperCase()
  const beforeTracking = String(input.before.trackingNumber || '').trim().toUpperCase()
  const beforePhase = normPhase(input.before.emsPhase)
  const afterPhase = normPhase(input.after.emsPhase)
  const beforeRank = phaseRank(beforePhase)
  const afterRank = phaseRank(afterPhase)
  const emsDetail = String(input.after.emsStatus || '').trim()
  const beforeStatus = String(input.before.shippingStatus || '').trim().toLowerCase()
  const afterStatus = String(input.after.shippingStatus || '').trim().toLowerCase()

  type Cand = { priority: number; event: CustomerInAppEvent }
  const candidates: Cand[] = []

  if (tracking && !beforeTracking) {
    candidates.push({
      priority: 20,
      event: { kind: 'tracking_assigned', orderCode: code, tracking },
    })
  }

  if (afterRank > beforeRank && emsPhaseInAppLabel('vi', afterPhase)) {
    candidates.push({
      priority: 40 + afterRank,
      event: { kind: 'ems_phase', orderCode: code, phase: afterPhase, emsDetail },
    })
  }

  if (afterStatus === 'shipping' && beforeStatus !== 'shipping' && afterStatus !== 'delivered') {
    candidates.push({
      priority: 35,
      event: { kind: 'shipping', orderCode: code, tracking: tracking || undefined },
    })
  }

  if (afterStatus === 'delivered' && beforeStatus !== 'delivered') {
    candidates.push({
      priority: 90,
      event: { kind: 'delivered_ems', orderCode: code, shopName: 'Shop' },
    })
  }

  if (!candidates.length) return null
  return candidates.reduce((a, b) => (b.priority > a.priority ? b : a)).event
}

export async function notifyPartnerCustomerEmsUpdateWebApp(input: {
  order: PartnerOrderRow
  before: EmsNotifySnapshot
  after: EmsNotifySnapshot
  locale?: string | null
}): Promise<void> {
  let event = pickPartnerCustomerEmsNotifyEvent({
    orderCode: orderCode(input.order),
    before: input.before,
    after: input.after,
  })
  if (!event) return
  if (event.kind === 'delivered_ems') {
    const shopName = await shopNameForPartner(input.order.partner_id)
    event = { ...event, shopName }
  }
  await notifyPartnerCustomerOrderWebApp({
    order: input.order,
    locale: input.locale,
    event: event as Exclude<CustomerInAppEvent, { kind: 'promo_grant' }>,
  })
}
