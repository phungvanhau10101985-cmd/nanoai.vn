'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { WebLocale } from '@/lib/i18n/config'
import {
  PARTNER_MARKETING_BANNER_CAROUSEL_MS,
  partnerMarketingBannerAlt,
  type PartnerMarketingBannerPublicItem,
} from '@/lib/partner-website/promotions/partner-marketing-banner'

type Props = {
  siteSlug: string
  locale: WebLocale
}

export function PartnerSiteMarketingBannerCarousel({ siteSlug, locale }: Props) {
  const [items, setItems] = useState<PartnerMarketingBannerPublicItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const didSwipe = useRef(false)

  const load = useCallback(async () => {
    if (!siteSlug) return
    setLoading(true)
    try {
      const res = await fetch(`/api/site/${encodeURIComponent(siteSlug)}/marketing-banners`, {
        credentials: 'same-origin',
      })
      const data = (await res.json().catch(() => null)) as { items?: PartnerMarketingBannerPublicItem[] } | null
      setItems(Array.isArray(data?.items) ? data.items : [])
      setActiveIndex(0)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [siteSlug])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (paused || items.length < 2) return
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % items.length)
    }, PARTNER_MARKETING_BANNER_CAROUSEL_MS)
    return () => window.clearInterval(timer)
  }, [items.length, paused])

  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(0)
  }, [activeIndex, items.length])

  if (loading) {
    return (
      <div
        className="mb-4 aspect-[21/9] w-full animate-pulse rounded-xl bg-[var(--pw-surface)]"
        aria-label={locale === 'vi' ? 'Đang tải banner ưu đãi' : 'Loading promo banners'}
      />
    )
  }

  const active = items[activeIndex] ?? null
  if (!active) return null

  const move = (direction: number) => {
    setActiveIndex((index) => (index + direction + items.length) % items.length)
  }

  return (
    <section
      className="relative mb-4 overflow-hidden rounded-xl border border-[var(--pw-border)] bg-[var(--pw-surface)] md:mb-5"
      aria-label={locale === 'vi' ? 'Ưu đãi dành cho bạn' : 'Offers for you'}
      data-pw-region="banner"
      data-pw-personalize-banner="promo"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null
        didSwipe.current = false
        setPaused(true)
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current
        const end = event.changedTouches[0]?.clientX
        touchStartX.current = null
        setPaused(false)
        if (start == null || end == null || items.length < 2) return
        const distance = end - start
        if (Math.abs(distance) < 40) return
        didSwipe.current = true
        move(distance < 0 ? 1 : -1)
      }}
    >
      <div className="relative aspect-[21/9] w-full overflow-hidden">
        {items.map((item, index) => (
          <Link
            key={item.id}
            href={item.href}
            tabIndex={index === activeIndex ? 0 : -1}
            aria-hidden={index !== activeIndex}
            className={`absolute inset-0 block transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-primary)] ${
              index === activeIndex ? 'z-[1] opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={(event) => {
              if (didSwipe.current) {
                event.preventDefault()
                didSwipe.current = false
              }
            }}
            aria-label={partnerMarketingBannerAlt(locale, item)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.image_url}
              alt={partnerMarketingBannerAlt(locale, item)}
              width={2100}
              height={900}
              className="block h-full w-full object-contain"
              loading="eager"
              decoding="async"
              onError={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
            />
          </Link>
        ))}
      </div>

      {active.greeting ? (
        <p
          data-pw-banner-greeting="1"
          className="border-t border-[var(--pw-border)] bg-[var(--pw-surface)] px-3 py-2 text-center text-sm font-semibold text-[var(--pw-text)]"
        >
          {active.greeting}
        </p>
      ) : null}

      {items.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => move(-1)}
            className="absolute left-2 top-1/2 z-[2] -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--pw-surface)_92%,transparent)] px-2.5 py-1.5 text-lg text-[var(--pw-primary)] shadow"
            aria-label={locale === 'vi' ? 'Banner trước' : 'Previous banner'}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="absolute right-2 top-1/2 z-[2] -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--pw-surface)_92%,transparent)] px-2.5 py-1.5 text-lg text-[var(--pw-primary)] shadow"
            aria-label={locale === 'vi' ? 'Banner tiếp theo' : 'Next banner'}
          >
            ›
          </button>
          <div className="absolute bottom-2 left-1/2 z-[2] flex -translate-x-1/2 gap-1.5">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`${locale === 'vi' ? 'Xem banner' : 'View banner'} ${index + 1}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                className={`h-1.5 rounded-full shadow-sm transition-all ${
                  index === activeIndex ? 'w-5 bg-[var(--pw-primary)]' : 'w-1.5 bg-white/90'
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}
