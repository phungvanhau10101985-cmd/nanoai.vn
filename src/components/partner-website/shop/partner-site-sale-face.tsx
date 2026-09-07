'use client'

import { useEffect, useRef, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import {
  formatPartnerSaleCountdownCompact,
  formatPartnerSaleMoney,
  partnerSiteBirthdayBadgeText,
  partnerSiteBirthdayCheckoutHint,
  partnerSiteSaleCopy,
  resolvePartnerProductSaleFace,
  writePartnerSaleCountdownNode,
  type PartnerProductSaleFace,
} from '@/lib/partner-website/promotions/partner-site-sale-display'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type SaleProduct = Parameters<typeof resolvePartnerProductSaleFace>[0] & {
  priceHint?: string | null
  birthdayOfferPercent?: number | null
  isClearance?: boolean
}

export function PartnerSiteSaleCountdown({
  countdownTo,
  phase,
  locale,
  overlay,
}: {
  countdownTo: string | null | undefined
  phase: 'teaser' | 'active'
  locale: WebLocale
  overlay?: boolean
}) {
  const copy = partnerSiteSaleCopy(locale)
  const hmsRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(() => Boolean(formatPartnerSaleCountdownCompact(countdownTo)))
  useEffect(() => {
    const tick = () => {
      const host = hmsRef.current
      if (host) {
        const box = host.getBoundingClientRect()
        const vh = window.innerHeight || 0
        const vw = window.innerWidth || 0
        if (box.bottom <= 0 || box.right <= 0 || box.top >= vh || box.left >= vw) return
      }
      const next = formatPartnerSaleCountdownCompact(countdownTo) || ''
      writePartnerSaleCountdownNode(host, next)
      setVisible((prev) => (Boolean(next) === prev ? prev : Boolean(next)))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [countdownTo])
  if (!visible) return null
  return (
    <span className={overlay ? `pw-sale-chip pw-sale-chip-${phase}` : `pw-sale-count pw-sale-count-${phase}`}>
      {phase === 'active' ? copy.remaining : copy.startsAfter}{' '}
      <span data-pw-sale-hms ref={hmsRef}>
        {formatPartnerSaleCountdownCompact(countdownTo) || ''}
      </span>
    </span>
  )
}

export function PartnerSiteSaleBadge({
  face,
  className = '',
}: {
  face: PartnerProductSaleFace
  className?: string
}) {
  if (!face.kind || !face.badge) return null
  return <span className={`pw-badge-sale pw-badge-sale-${face.kind}${face.promoKind ? ` pw-badge-sale-${face.promoKind}` : ''} ${className}`.trim()}>{face.badge}</span>
}

export function PartnerSiteSalePriceBlock({
  product,
  locale,
  fallback,
  className = 'pw-shop-price',
}: {
  product: SaleProduct
  locale: WebLocale
  fallback?: string | null
  className?: string
}) {
  const face = resolvePartnerProductSaleFace(product, locale)
  const copy = partnerSiteSaleCopy(locale)
  const birthdayHint =
    product.isClearance === true
      ? null
      : partnerSiteBirthdayCheckoutHint(product.birthdayOfferPercent, locale)
  if (!face.kind) {
    const text = fallback || ''
    return text || birthdayHint ? (
      <p className={className} data-pw-el={PW_EL.cardPrice}>
        {text}
        {birthdayHint ? <small className="pw-price-birthday">{birthdayHint}</small> : null}
      </p>
    ) : null
  }
  if (face.kind === 'teaser') {
    return (
      <p className={className} data-pw-el={PW_EL.cardPrice}>
        <span className="pw-price-sale">{formatPartnerSaleMoney(face.displayPrice, locale)}</span>
        {face.expectedPrice != null ? (
          <span className="pw-price-expected"> → {formatPartnerSaleMoney(face.expectedPrice, locale)}</span>
        ) : null}
        <small className="pw-price-teaser">
          {copy.expectedSave
            .replace('{pct}', String(face.percent))
            .replace('{amount}', formatPartnerSaleMoney(face.savings, locale))}
        </small>
        {birthdayHint ? <small className="pw-price-birthday">{birthdayHint}</small> : null}
      </p>
    )
  }
  return (
    <p className={className} data-pw-el={PW_EL.cardPrice}>
      <span className="pw-price-sale">{formatPartnerSaleMoney(face.displayPrice, locale)}</span>
      {face.comparePrice != null ? (
        <del className="pw-price-compare">{formatPartnerSaleMoney(face.comparePrice, locale)}</del>
      ) : null}
      {face.savings > 0 ? (
        <small className="pw-price-save">
          {copy.save.replace('{amount}', formatPartnerSaleMoney(face.savings, locale))}
        </small>
      ) : null}
      {birthdayHint ? <small className="pw-price-birthday">{birthdayHint}</small> : null}
    </p>
  )
}

export function PartnerSiteSaleMediaMarks({
  product,
  locale,
}: {
  product: SaleProduct
  locale: WebLocale
}) {
  const face = resolvePartnerProductSaleFace(product, locale)
  const birthdayBadge =
    product.isClearance === true
      ? null
      : partnerSiteBirthdayBadgeText(product.birthdayOfferPercent, locale)
  if (!face.kind && !birthdayBadge) return null
  return (
    <>
      {face.kind && face.badge ? <PartnerSiteSaleBadge face={face} /> : null}
      {birthdayBadge ? <span className="pw-badge-birthday">{birthdayBadge}</span> : null}
      {face.kind && face.countdownTo ? (
        <PartnerSiteSaleCountdown countdownTo={face.countdownTo} phase={face.kind} locale={locale} overlay />
      ) : null}
    </>
  )
}

export function partnerProductSaleFaceOf(product: SaleProduct, locale: WebLocale = 'vi') {
  return resolvePartnerProductSaleFace(product, locale)
}
