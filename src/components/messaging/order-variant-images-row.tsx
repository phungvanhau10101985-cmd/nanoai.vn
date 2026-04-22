'use client'

import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { parsePartnerOrderVariantImageUrls } from '@/lib/messaging/partner-order-variant-images'

type LabelProps = { sectionLabel: string; imageAltPrefix: string }

export function OrderVariantImagesRow({
  order,
  labels,
  className = '',
}: {
  order: Pick<PartnerOrderRow, 'variant_image_urls'>
  labels: LabelProps
  className?: string
}) {
  const urls = parsePartnerOrderVariantImageUrls(order.variant_image_urls)
  if (urls.length === 0) return null
  return (
    <div className={`space-y-1.5 border-t border-border/40 pt-2 ${className}`.trim()}>
      <p className="text-[11px] font-medium text-muted-foreground">{labels.sectionLabel}</p>
      <div className="flex flex-wrap gap-2">
        {urls.map((src, i) => (
          <a
            key={`${i}-${src.slice(0, 64)}`}
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="block shrink-0 rounded-md border border-border/60 bg-muted/20 p-0.5 transition-opacity hover:opacity-90"
            title={labels.imageAltPrefix}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- URL từ kho shop / CDN */}
            <img
              src={src}
              alt={`${labels.imageAltPrefix} ${i + 1}`}
              className="h-16 w-16 object-contain object-center sm:h-20 sm:w-20"
              loading="lazy"
            />
          </a>
        ))}
      </div>
    </div>
  )
}
