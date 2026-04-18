'use client'

import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import {
  parsePartnerOrderVariantLines,
  totalQtyFromVariantLines,
} from '@/lib/messaging/partner-order-variant-lines'

type Labels = {
  sectionLabel: string
  imageAltPrefix: string
  sizeLabel: string
  qtyLabel: string
  totalQtySummaryLabel: string
}

export function OrderVariantLinesDetail({
  order,
  labels,
  className = '',
}: {
  order: PartnerOrderRow
  labels: Labels
  className?: string
}) {
  const lines = parsePartnerOrderVariantLines(order)
  if (!lines?.length) return null
  const total = totalQtyFromVariantLines(lines)

  return (
    <div className={`space-y-2 border-t border-border/40 pt-2 ${className}`.trim()}>
      <p className="text-[11px] font-medium text-muted-foreground">{labels.sectionLabel}</p>
      <ul className="space-y-2.5">
        {lines.map((line, i) => (
          <li
            key={`${i}-${line.imageUrl.slice(0, 48)}`}
            className="flex gap-3 rounded-lg border border-border/50 bg-muted/10 p-2 sm:gap-4"
          >
            <a
              href={line.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md border border-border/60 bg-background p-0.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- URL shop/CDN */}
              <img
                src={line.imageUrl}
                alt={`${labels.imageAltPrefix} — ${line.variantName}`}
                className="h-20 w-20 object-contain object-center sm:h-24 sm:w-24"
                loading="lazy"
              />
            </a>
            <div className="min-w-0 flex-1 space-y-1 text-[13px] leading-snug">
              <p className="font-medium text-foreground">{line.variantName}</p>
              <p>
                <span className="text-muted-foreground">{labels.sizeLabel}: </span>
                <span className="font-medium">{line.size}</span>
              </p>
              <p>
                <span className="text-muted-foreground">{labels.qtyLabel}: </span>
                <span className="font-medium tabular-nums">{line.qty}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
      {lines.length > 1 ? (
        <p className="text-[12px] text-muted-foreground">
          <span className="font-medium text-foreground/90">{labels.totalQtySummaryLabel}:</span>{' '}
          <span className="tabular-nums font-medium">{total}</span>
        </p>
      ) : null}
    </div>
  )
}
