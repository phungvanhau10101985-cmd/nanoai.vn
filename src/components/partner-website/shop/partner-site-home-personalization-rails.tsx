'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSitePersonalizationProduct } from '@/lib/partner-website/shop/partner-site-personalization'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSitePersonalizationApiPath,
  partnerSiteProductPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'

function HomeRail({
  siteSlug,
  title,
  apiTail,
}: {
  siteSlug: string
  title: string
  apiTail: string
}) {
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [products, setProducts] = useState<PartnerSitePersonalizationProduct[]>([])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    fetch(partnerSitePersonalizationApiPath(siteSlug, apiTail), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
      .then((res) => {
        captureFromResponse(res)
        return res.ok ? res.json() : {}
      })
      .then((json: { products?: PartnerSitePersonalizationProduct[] }) => {
        if (!cancelled) setProducts(Array.isArray(json.products) ? json.products.slice(0, 8) : [])
      })
      .catch(() => {
        if (!cancelled) setProducts([])
      })
    return () => {
      cancelled = true
    }
  }, [apiTail, authHeaders, captureFromResponse, ready, siteSlug])

  if (!products.length) return null

  return (
    <section className="mb-12 sm:mb-16">
      <h2
        className="pw-fh-heading mb-6 text-sm font-extrabold uppercase tracking-[0.2em] sm:text-base"
        style={{ fontFamily: 'var(--pw-font-display)' }}
      >
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5">
        {products.map((p) => {
          const href = partnerSiteProductPath(siteSlug, p.inventory_id, {
            customDomain,
            name: p.name,
          })
          return (
            <Link key={p.inventory_id} href={href} className="group block overflow-hidden rounded-2xl border bg-white">
              <span className="relative block aspect-[4/5] overflow-hidden bg-[var(--pw-surface)]">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </span>
              <span className="block p-3">
                <span className="line-clamp-2 text-sm font-semibold text-stone-800">{p.name}</span>
                {p.price_hint ? (
                  <span className="pw-fh-price mt-1 block text-sm font-extrabold">{p.price_hint}</span>
                ) : null}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function PartnerSiteHomePersonalizationRails({
  siteSlug,
  locale,
}: {
  siteSlug: string
  locale: WebLocale
}) {
  const t = getPartnerSiteShopCopy(locale)
  return (
    <>
      <HomeRail
        siteSlug={siteSlug}
        title={t.recentlyViewedTitle}
        apiTail="recently-viewed?limit=8"
      />
      <HomeRail siteSlug={siteSlug} title={t.wishlistTitle} apiTail="favorites?limit=8" />
    </>
  )
}
