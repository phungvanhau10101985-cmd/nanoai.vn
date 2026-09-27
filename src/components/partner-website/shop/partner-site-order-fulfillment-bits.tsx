'use client'

import Link from 'next/link'
import type { WebLocale } from '@/lib/i18n/config'
import {
  publicShipmentProcessingLabel,
  publicShipmentStepHint,
  publicShipmentStepTitle,
  publicShipmentTimelineFooter,
  publicShipmentTimelineHeading,
  shipmentTimelineVariantFromSteps,
} from '@/lib/messaging/fulfillment/customer-shipment-timeline-copy'
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

function formatTimelineWhen(locale: WebLocale, iso?: string | null): string {
  const raw = String(iso || '').trim()
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export type ShopSiblingOrderView = {
  id: string
  payment_reference?: string | null
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
  void _props
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
  locale = 'vi',
  shopName = '',
  depositFlow = false,
  events,
  fallback,
}: {
  t: ReturnType<typeof getPartnerSiteShopCopy>
  locale?: WebLocale
  shopName?: string
  depositFlow?: boolean
  events?: ShopShipmentEventView[] | null
  fallback: Array<{ key: string; label: string; done: boolean; active: boolean }>
}) {
  const live = (events || []).filter((event) => event.stepKey && event.status !== 'skipped')
  const variant = shipmentTimelineVariantFromSteps(live.map((event) => event.stepKey))
  if (variant && live.length > 0) {
    return (
      <>
        <p style={{ fontWeight: 700, margin: '0 0 10px' }}>{publicShipmentTimelineHeading({ locale, variant })}</p>
        <ol className="pw-shop-order-timeline">
          {live.map((event) => {
            const stepKey = event.stepKey || 'step'
            const title =
              publicShipmentStepTitle({
                locale,
                shopName,
                stepKey,
                variant,
                depositFlow,
              }) || event.title || stepKey
            const hint = publicShipmentStepHint({ locale, shopName, stepKey })
            const when =
              event.status === 'completed'
                ? formatTimelineWhen(locale, event.completedAt)
                : event.status === 'active'
                  ? publicShipmentProcessingLabel(locale)
                  : ''
            return (
              <li
                key={stepKey}
                className={event.status === 'completed' ? 'is-done' : event.status === 'active' ? 'is-active' : undefined}
              >
                <span className="pw-shop-order-timeline-title">{title}</span>
                {when ? <span className="pw-shop-order-timeline-when">{when}</span> : null}
                {hint ? <span className="pw-shop-order-timeline-note">{hint}</span> : null}
              </li>
            )
          })}
        </ol>
        <p className="pw-shop-order-timeline-foot">{publicShipmentTimelineFooter({ locale, shopName, variant })}</p>
      </>
    )
  }

  const steps =
    live.length > 0
      ? live.map((event) => ({
          key: event.stepKey || event.title || 'step',
          label:
            event.stepKey === 'confirmed'
              ? t.orderTimelineConfirmed
              : event.stepKey === 'awaiting_confirm'
                ? t.orderTimelineShipping
                : t.orderTimelineCreated,
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
      {steps.find((step) => step.active) ? (
        <p className="pw-shop-muted" style={{ marginTop: 8 }}>
          {steps.find((step) => step.active)?.key === 'awaiting_confirm'
            ? t.orderWaitingBuyer
            : t.orderWaitingSeller}
        </p>
      ) : null}
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
