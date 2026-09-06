'use client'

import { useEffect, useRef, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import {
  formatPartnerSaleCountdownCompact,
  formatPartnerSaleMoney,
  partnerSiteSaleCopy,
  resolvePartnerProductSaleFace,
  writePartnerSaleCountdownNode,
  type PartnerProductSaleFace,
} from '@/lib/partner-website/promotions/partner-site-sale-display'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type SaleProduct = Parameters<typeof resolvePartnerProductSaleFace>[0] & {
  priceHint?: string | null
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
  return <span className={`pw-badge-sale pw-badge-sale-${face.kind} ${className}`.trim()}>{face.badge}</span>
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
  const face = resolvePartnerProductSaleFace(product)
  const copy = partnerSiteSaleCopy(locale)
  if (!face.kind) {
    const text = fallback || ''
    return text ? (
      <p className={className} data-pw-el={PW_EL.cardPrice}>
        {text}
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
  const face = resolvePartnerProductSaleFace(product)
  if (!face.kind || !face.badge) return null
  return (
    <>
      <PartnerSiteSaleBadge face={face} />
      {face.countdownTo ? (
        <PartnerSiteSaleCountdown countdownTo={face.countdownTo} phase={face.kind} locale={locale} overlay />
      ) : null}
    </>
  )
}

export function partnerProductSaleFaceOf(product: SaleProduct) {
  return resolvePartnerProductSaleFace(product)
}
