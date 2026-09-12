'use client'

import Link from 'next/link'
import { displayShopOrderCode } from '@/lib/messaging/shop-payment-reference'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteOrderDetailPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export type ShopShipmentEventView = {
  stepKey?: string
  title?: string
  status?: string
  scheduledAt?: string | null
  completedAt?: string | null
}

export type ShopSiblingOrderView = {
  id: string
  payment_reference?: string | null
  fulfillment_source?: string | null
}

export function shopFulfillmentSourceLabel(
  t: ReturnType<typeof getPartnerSiteShopCopy>,
  source?: string | null
): string {
  return source === 'china' ? t.orderFulfillmentChina : t.orderFulfillmentVietnam
}

export function genericShippingTimelineSteps(
  ship: string | null | undefined,
  t: ReturnType<typeof getPartnerSiteShopCopy>
): Array<{ key: string; label: string; done: boolean; active: boolean }> {
  const order = ['pending', 'confirmed', 'packing', 'shipping', 'delivered']
  const idx = Math.max(0, order.indexOf(String(ship ?? 'pending')))
  const labels = [
    t.orderTimelineCreated,
    t.orderTimelineConfirmed,
    t.orderTimelinePacking,
    t.orderTimelineShipping,
    t.orderTimelineDelivered,
  ]
  return order.map((key, i) => ({
    key,
    label: labels[i] ?? key,
    done: i < idx || ship === 'delivered',
    active: i === idx && ship !== 'delivered' && ship !== 'cancelled' && ship !== 'returned',
  }))
}

export function shopSourcePlatformLabel(platform?: string | null): string {
  const p = String(platform || '').trim().toLowerCase()
  if (p === '1688') return '1688'
  if (p === 'taobao') return 'Taobao'
  if (p === 'tmall') return 'Tmall'
  return ''
}

/** Nguồn hàng (VN/TQ / 1688) chỉ cho người bán. Storefront khách không hiện. */
export function PartnerSiteOrderFulfillmentBadge(_props: {
  t: ReturnType<typeof getPartnerSiteShopCopy>
  source?: string | null
  platform?: string | null
}) {
  return null
}

export function PartnerSiteOrderSplitGroup({
  t,
  siteSlug,
  customDomain,
  currentId,
  siblings,
}: {
  t: ReturnType<typeof getPartnerSiteShopCopy>
  siteSlug: string
  customDomain?: boolean
  currentId: string
  siblings?: ShopSiblingOrderView[] | null
}) {
  const others = (siblings || []).filter((row) => row.id && row.id !== currentId)
  if (others.length === 0) return null
  return (
    <div className="pw-shop-muted" style={{ marginTop: 8 }}>
      <p style={{ margin: 0 }}>{t.orderSplitBanner}</p>
      <p style={{ margin: '4px 0 0' }}>
        {others.map((row, index) => {
          const code = displayShopOrderCode(row.payment_reference?.trim() || '') || row.id.slice(0, 8)
          return (
            <span key={row.id}>
              {index > 0 ? ' · ' : null}
              <Link href={partnerSiteOrderDetailPath(siteSlug, row.id, { customDomain })}>{code}</Link>
            </span>
          )
        })}
      </p>
    </div>
  )
}

export function PartnerSiteOrderShipmentSteps({
  t,
  events,
  fallback,
}: {
  t: ReturnType<typeof getPartnerSiteShopCopy>
  events?: ShopShipmentEventView[] | null
  fallback: Array<{ key: string; label: string; done: boolean; active: boolean }>
}) {
  const live = (events || []).filter((event) => event.title || event.stepKey)
  const steps =
    live.length > 0
      ? live
          .filter((event) => event.status !== 'skipped')
          .map((event) => ({
            key: event.stepKey || event.title || 'step',
            label: event.title || event.stepKey || '',
            done: event.status === 'completed',
            active: event.status === 'active',
          }))
      : fallback
  return (
    <>
      <p style={{ fontWeight: 700, margin: '0 0 10px' }}>{t.orderTimelineTitle}</p>
      <ol className="pw-shop-order-timeline">
        {steps.map((step) => (
          <li key={step.key} className={step.done ? 'is-done' : step.active ? 'is-active' : undefined}>
            {step.label}
          </li>
        ))}
      </ol>
    </>
  )
}

export function PartnerSiteOrderEmsTracking({
  t,
  trackingNumber,
}: {
  t: ReturnType<typeof getPartnerSiteShopCopy>
  trackingNumber?: string | null
}) {
  const code = String(trackingNumber || '').trim()
  if (!code) return null
  return (
    <p className="pw-shop-muted" style={{ marginTop: 8 }}>
      {t.orderEmsTracking}: {code}
    </p>
  )
}
