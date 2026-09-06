'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSaleCalendarState } from '@/lib/partner-website/promotions/partner-sale-calendar'
import {
  formatPartnerSaleCountdownCompact,
  partnerSiteSaleBannerShowsOnPage,
  partnerSiteSaleBannerStorageKey,
  partnerSiteSaleBannerText,
  partnerSiteSaleCopy,
  writePartnerSaleCountdownNode,
} from '@/lib/partner-website/promotions/partner-site-sale-display'
import { partnerSiteSaleCalendarApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import type { PwPageKind } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  siteSlug: string
  locale: WebLocale
  pageKind?: PwPageKind | null
  hideOnAuth?: boolean
}

export function PartnerSiteSaleCalendarBanner({ siteSlug, locale, pageKind, hideOnAuth }: Props) {
  const copy = partnerSiteSaleCopy(locale)
  const visiblePage = partnerSiteSaleBannerShowsOnPage(pageKind) && !hideOnAuth
  const [state, setState] = useState<PartnerSaleCalendarState | null>(null)
  const [closed, setClosed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!visiblePage || !siteSlug) return
    let cancelled = false
    fetch(partnerSiteSaleCalendarApiPath(siteSlug), { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const next = data?.state as PartnerSaleCalendarState | undefined
        setState(next && next.phase !== 'off' ? next : null)
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [siteSlug, visiblePage])

  const storageKey = useMemo(
    () => partnerSiteSaleBannerStorageKey({ eventDate: state?.eventDate, phase: state?.phase }),
    [state?.eventDate, state?.phase]
  )

  useEffect(() => {
    if (!ready || !state) return
    try {
      setClosed(sessionStorage.getItem(storageKey) === '1')
    } catch {
      setClosed(false)
    }
  }, [ready, state, storageKey])

  const hmsRef = useRef<HTMLElement>(null)
  const [hasCount, setHasCount] = useState(() => Boolean(formatPartnerSaleCountdownCompact(state?.countdownTo)))
  useEffect(() => {
    const tick = () => {
      const host = hmsRef.current
      if (host) {
        const box = host.getBoundingClientRect()
        const vh = window.innerHeight || 0
        const vw = window.innerWidth || 0
        if (box.bottom <= 0 || box.right <= 0 || box.top >= vh || box.left >= vw) return
      }
      const next = formatPartnerSaleCountdownCompact(state?.countdownTo) || ''
      writePartnerSaleCountdownNode(host, next)
      setHasCount((prev) => (Boolean(next) === prev ? prev : Boolean(next)))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [state?.countdownTo])

  if (!visiblePage || !ready || !state || closed) return null
  const message = partnerSiteSaleBannerText(state, locale)
  if (!message) return null
  const phase = state.phase === 'active' ? 'active' : 'teaser'
  const title = `${state.isTest ? '[Test] ' : ''}${state.eventLabel || copy.program}`
  const prefix = (phase === 'active' ? copy.countdownLeft : copy.countdownStarts).replace(
    '{label}',
    state.eventLabel || copy.program
  )

  return (
    <aside data-pw-sale-calendar-banner="1" data-pw-sale-banner-react="1" data-pw-sale-phase={phase} role="status" aria-live="off">
      <button
        type="button"
        data-pw-sale-close
        aria-label={copy.close}
        onClick={() => {
          setClosed(true)
          try {
            sessionStorage.setItem(storageKey, '1')
          } catch {
            /* noop */
          }
        }}
      >
        ×
      </button>
      <p data-pw-sale-title>{title}</p>
      <p data-pw-sale-msg>{message}</p>
      {hasCount ? (
        <span data-pw-sale-count>
          {prefix}{' '}
          <strong data-pw-sale-hms ref={hmsRef}>
            {formatPartnerSaleCountdownCompact(state.countdownTo) || ''}
          </strong>
        </span>
      ) : null}
    </aside>
  )
}
