'use client'

import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSizeGuideKind } from '@/lib/partner-website/shop/partner-site-size-guide'
import { partnerSizeGuideCopy } from '@/lib/partner-website/shop/partner-site-size-guide'
import {
  buildPartnerSizeGuideHostHtml,
  PARTNER_SIZE_GUIDE_CSS,
} from '@/lib/partner-website/shop/partner-site-size-guide-html'
import { shopPdpPageSrc } from '@/lib/partner-website/shop/inventory-shop-detail'

export function PartnerSiteSizeGuideModal({
  open,
  onClose,
  locale,
  siteSlug,
  shopName,
  customDomain = false,
  kind = null,
  title,
  closeLabel,
  imageUrl = null,
}: {
  open: boolean
  onClose: () => void
  locale: WebLocale
  siteSlug: string
  shopName?: string | null
  customDomain?: boolean
  kind?: PartnerSizeGuideKind | null
  title: string
  closeLabel: string
  imageUrl?: string | null
}) {
  if (!open) return null
  const copy = partnerSizeGuideCopy(locale)
  const html = buildPartnerSizeGuideHostHtml({
    kind,
    locale,
    siteSlug,
    shopName,
    customDomain,
    includeLead: !kind,
  })
  const img = String(imageUrl || '').trim()
  const imgSrc = img ? shopPdpPageSrc(img) || img : ''

  return (
    <div
      data-pw-size-guide-modal=""
      role="dialog"
      aria-modal="true"
      aria-labelledby="pw-size-guide-heading"
      onClick={onClose}
    >
      <style data-pw-size-guide-css="1">{PARTNER_SIZE_GUIDE_CSS}</style>
      <div className="pw-size-guide-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="pw-size-guide-dialog-head">
          <strong id="pw-size-guide-heading">{title}</strong>
          <button type="button" data-pw-size-guide-close="" onClick={onClose} aria-label={closeLabel}>
            ✕
          </button>
        </div>
        <div className="pw-size-guide-dialog-body">
          <div dangerouslySetInnerHTML={{ __html: html }} />
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={copy.indexTitle}
              decoding="async"
              style={{ width: '100%', height: 'auto', marginTop: 16, borderRadius: 8, border: '1px solid var(--pw-border)' }}
              onError={(ev) => {
                ev.currentTarget.hidden = true
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
