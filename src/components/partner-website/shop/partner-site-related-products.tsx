'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  partnerSiteCategoryPath,
  partnerSiteProductPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  siteSlug: string
  locale: WebLocale
  products: PartnerSiteShopProduct[]
  categoryPath?: string | null
}

function relatedStepFromViewport(): number {
  if (typeof window === 'undefined') return 5
  return window.matchMedia('(min-width: 1280px)').matches ? 5 : 2
}

export function PartnerSiteRelatedProducts({
  siteSlug,
  locale,
  products,
  categoryPath = null,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const [step, setStep] = useState(5)
  const [visible, setVisible] = useState(5)

  useEffect(() => {
    const sync = () => {
      const next = relatedStepFromViewport()
      setStep(next)
      setVisible((current) => {
        if (current <= next) return Math.min(next, products.length)
        return Math.min(current, products.length)
      })
    }
    sync()
    const mq = window.matchMedia('(min-width: 1280px)')
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [products.length])

  const moreHref = categoryPath
    ? partnerSiteCategoryPath(siteSlug, categoryPath, { customDomain })
    : partnerSiteProductsPath(siteSlug, { customDomain })
  const shown = products.slice(0, visible)
  const canLoadMore = visible < products.length

  return (
    <section
      className="pw-related pw-catalog"
      data-pw-region={PW_REGION.catalog}
      data-pw-catalog
      data-pw-related="1"
      data-pw-grid-kind="related"
    >
      <h3 className="pw-related-title" data-pw-el={PW_EL.sectionTitle}>
        {t.relatedProducts}
      </h3>
      {products.length ? (
        <>
          <div
            className="pw-product-grid pw-related-grid"
            style={{ marginTop: 12 }}
            data-pw-el={PW_EL.grid}
            data-pw-grid
          >
            {shown.map((p) => {
              const href = partnerSiteProductPath(siteSlug, p.id, { customDomain, name: p.name })
              return (
                <article key={p.id} className="pw-product-card pw-related-card" data-pw-el={PW_EL.card}>
                  <Link className="pw-product-card-media" href={href} data-pw-el={PW_EL.cardMedia}>
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.visibility = 'hidden'
                        }}
                      />
                    ) : null}
                  </Link>
                  <div className="pw-product-card-body pw-related-card-body">
                    <h4 data-pw-el={PW_EL.cardName}>
                      <Link href={href}>{p.name}</Link>
                    </h4>
                    {p.priceHint ? (
                      <p className="pw-price" data-pw-el={PW_EL.cardPrice}>
                        {p.priceHint}
                      </p>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
          <div className="pw-related-actions">
            {canLoadMore ? (
              <button
                type="button"
                className="pw-related-more"
                data-pw-related-more
                onClick={() => setVisible((n) => Math.min(n + step, products.length))}
              >
                <span className="pw-related-more-icon" aria-hidden="true">
                  ↻
                </span>
                {t.loadMore}
              </button>
            ) : null}
            <Link className="pw-related-all" href={moreHref} data-pw-el={PW_EL.sectionMore}>
              {t.relatedSeeAll}
            </Link>
          </div>
        </>
      ) : (
        <p className="pw-related-empty">{t.relatedEmpty}</p>
      )}
    </section>
  )
}
