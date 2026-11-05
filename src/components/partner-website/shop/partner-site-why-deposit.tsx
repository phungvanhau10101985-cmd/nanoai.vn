'use client'

import { useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { formatVnd } from '@/lib/partner-website/shop/cart-line-utils'
import { getWhyDepositCopy } from '@/lib/partner-website/shop/why-deposit-copy'
import {
  fillWhyDeposit,
  isWhyDepositHttpUrl,
  whyDepositZaloMessageFromCopy,
  type WhyDepositPolicy,
} from '@/lib/partner-website/shop/why-deposit'

type Props = {
  locale: WebLocale
  shopName: string
  orderId: string | null
  orderCode: string
  zaloUrl: string | null
  policy: WhyDepositPolicy
  backHref: string
  howToBuyHref: string
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  )
}

function trackWhyDeposit(name: string, orderId: string | null, extra?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  const payload = { order_id: orderId ?? undefined, ...extra }
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
  gtag?.('event', name, payload)
}

export function PartnerSiteWhyDeposit({
  locale,
  shopName,
  orderId,
  orderCode,
  zaloUrl,
  policy,
  backHref,
  howToBuyHref,
}: Props) {
  const copy = getWhyDepositCopy(locale)
  const [toast, setToast] = useState<{ title: string; description: string } | null>(null)
  const shop = shopName.trim() || 'shop'
  const vars = {
    shop,
    percent: policy.percent,
    minAmount: formatVnd(policy.minAmount),
    highOrderAmount: formatVnd(policy.highOrderAmount),
    highOrderPercent: policy.highOrderPercent,
  }
  const showHighOrder = policy.highOrderAmount > 0 && policy.highOrderPercent > 0
  const backLabel = orderId ? copy.backToPay : copy.backToOrders
  const zaloHref = isWhyDepositHttpUrl(zaloUrl) ? String(zaloUrl).trim() : ''

  const contactZalo = () => {
    const message = whyDepositZaloMessageFromCopy(copy, orderCode, shop)
    trackWhyDeposit('deposit_why_zalo_click', orderId, { has_order_code: Boolean(orderCode) })
    if (zaloHref) {
      window.open(zaloHref, '_blank', 'noopener,noreferrer')
    }
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    if (!clipboard?.writeText) {
      setToast({
        title: zaloHref ? copy.zaloOpenedTitle : copy.zaloMissingTitle,
        description: message,
      })
      return
    }
    void clipboard.writeText(message).then(
      () => {
        setToast({
          title: zaloHref ? copy.zaloCopiedTitle : copy.zaloMissingTitle,
          description: orderCode ? copy.zaloCopiedWithCode : copy.zaloCopiedPlain,
        })
      },
      () => {
        setToast({
          title: zaloHref ? copy.zaloOpenedTitle : copy.zaloMissingTitle,
          description: message,
        })
      }
    )
  }

  return (
    <div className="pw-shop-why-deposit">
      <article className="pw-shop-why-card">
        <header className="pw-shop-why-head">
          <h1>{copy.pageTitle}</h1>
          <p>
            {orderCode ? `${fillWhyDeposit(copy.leadOrder, { code: orderCode })} ` : null}
            {fillWhyDeposit(copy.lead, { shop })}
          </p>
        </header>
        <div className="pw-shop-why-body">
          <section>
            <h2>{copy.sectionWarehouseTitle}</h2>
            <p>
              <RichText text={fillWhyDeposit(copy.sectionWarehouseP1, { shop })} />
            </p>
            <p>{copy.sectionWarehouseP2}</p>
          </section>
          <section>
            <h2>{copy.sectionFeesTitle}</h2>
            <p>{copy.sectionFeesP1}</p>
            <p>{copy.sectionFeesP2}</p>
          </section>
          <section>
            <h2>{copy.sectionHoldTitle}</h2>
            <p>{copy.sectionHoldP1}</p>
            <p>{copy.sectionHoldP2}</p>
          </section>
          <section className="pw-shop-why-note">
            <h2>{copy.sectionPartialTitle}</h2>
            <p>
              <RichText text={fillWhyDeposit(copy.sectionPartialP1, vars)} />
            </p>
            <p>
              <RichText text={copy.sectionPartialP2} />
            </p>
            {showHighOrder ? (
              <p>
                <RichText text={fillWhyDeposit(copy.sectionPartialP3, vars)} />
              </p>
            ) : null}
          </section>
          <section>
            <h2>{copy.sectionKeepTitle}</h2>
            <p>{copy.sectionKeepP1}</p>
          </section>
          <section>
            <h2>{copy.sectionAfterTitle}</h2>
            <p>{copy.sectionAfterP1}</p>
          </section>
        </div>
        <div className="pw-shop-why-foot">
          {toast ? (
            <div className="pw-shop-why-toast" role="status">
              <strong>{toast.title}</strong>
              <span>{toast.description}</span>
            </div>
          ) : null}
          <a
            href={backHref}
            className="pw-shop-btn pw-shop-btn-buy"
            onClick={() => trackWhyDeposit('deposit_why_back_to_pay', orderId)}
          >
            {backLabel}
          </a>
          <button type="button" className="pw-shop-btn pw-shop-why-zalo" onClick={contactZalo}>
            {copy.zaloButton}
          </button>
          <p className="pw-shop-why-hours">
            {copy.zaloHours}
            {orderCode ? ` ${copy.zaloPasteHint}` : null}
          </p>
          <p className="pw-shop-why-guide">
            <a href={howToBuyHref}>{copy.howToBuy}</a>
          </p>
        </div>
      </article>
    </div>
  )
}
