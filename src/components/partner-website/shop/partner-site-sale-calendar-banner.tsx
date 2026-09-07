'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSaleCalendarState } from '@/lib/partner-website/promotions/partner-sale-calendar'
import {
  formatPartnerSaleCountdownCompact,
  partnerSiteBirthdayBannerText,
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
  const [birthdayPercent, setBirthdayPercent] = useState(0)
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
        setBirthdayPercent(Math.max(0, Math.round(Number(data?.birthdayOffer?.percent) || 0)))
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [siteSlug, visiblePage])

  const storageKey = useMemo(() => {
    if (state && state.phase !== 'off') {
      return partnerSiteSaleBannerStorageKey({ eventDate: state.eventDate, phase: state.phase })
    }
    if (birthdayPercent > 0) return `pw_site_sale_banner_birthday_${birthdayPercent}`
    return 'pw_site_sale_banner_off'
  }, [state, birthdayPercent])

  useEffect(() => {
    if (!ready || (!state && birthdayPercent <= 0)) return
    try {
      setClosed(sessionStorage.getItem(storageKey) === '1')
    } catch {
      setClosed(false)
    }
  }, [ready, state, birthdayPercent, storageKey])

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

  if (!visiblePage || !ready || closed) return null
  const message = state ? partnerSiteSaleBannerText(state, locale) : null
  const birthdayMsg = partnerSiteBirthdayBannerText(birthdayPercent, locale)
  if (!message && !birthdayMsg) return null
  const phase = state?.phase === 'active' ? 'active' : state?.phase === 'teaser' ? 'teaser' : 'active'
  const title = state
    ? `${state.isTest ? '[Test] ' : ''}${state.eventLabel || copy.program}`
    : copy.program
  const prefix = state
    ? (phase === 'active' ? copy.countdownLeft : copy.countdownStarts).replace(
        '{label}',
        state.eventLabel || copy.program
      )
    : ''

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
            if (birthdayPercent > 0 && state) {
              sessionStorage.setItem(`pw_site_sale_banner_birthday_${birthdayPercent}`, '1')
            }
          } catch {
            /* noop */
          }
        }}
      >
        ×
      </button>
      <p data-pw-sale-title>{title}</p>
      {message ? <p data-pw-sale-msg>{message}</p> : null}
      {birthdayMsg ? <p data-pw-sale-msg data-pw-birthday-msg="1">{birthdayMsg}</p> : null}
      {hasCount && state?.countdownTo ? (
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
