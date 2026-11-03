'use client'

import { useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerHolidayThemePublicState } from '@/lib/partner-website/promotions/partner-holiday-theme'
import { partnerSiteHolidayThemeApiPath } from '@/lib/partner-website/shop/build-partner-holiday-theme-bootstrap-script'

const COPY: Record<WebLocale, { previewOnly: string }> = {
  vi: { previewOnly: 'Chỉ admin thấy, còn {left}. Khách không thấy.' },
  en: { previewOnly: 'Admins only, {left} left. Shoppers do not see this.' },
  zh: { previewOnly: '仅管理员可见，剩余 {left}。顾客看不到。' },
  ja: { previewOnly: '管理者のみ、残り {left}。客には見えません。' },
  ko: { previewOnly: '관리자만 보입니다. {left} 남음. 고객은 보지 못합니다.' },
}

function remaining(expiresAt: number | null): string {
  if (!expiresAt) return '0:00'
  const left = Math.max(0, expiresAt * 1000 - Date.now())
  const mm = Math.floor(left / 60000)
  const ss = Math.floor((left % 60000) / 1000)
  return `${mm}:${String(ss).padStart(2, '0')}`
}

export function PartnerSiteHolidayTheme({
  siteSlug,
  locale,
}: {
  siteSlug: string
  locale: WebLocale
}) {
  const [state, setState] = useState<PartnerHolidayThemePublicState | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!siteSlug) return
    let cancelled = false
    const load = () => {
      fetch(`${partnerSiteHolidayThemeApiPath(siteSlug)}${window.location.search}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data?.ok) return
          setState(data as PartnerHolidayThemePublicState)
        })
        .catch(() => undefined)
    }
    load()
    const timer = window.setInterval(load, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [siteSlug])

  useEffect(() => {
    if (!state?.preview) return
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(timer)
  }, [state?.preview])

  useEffect(() => {
    const html = document.documentElement
    const look = state?.look
    if (!state?.activeTheme || !look) {
      html.classList.remove('holiday-on')
      html.removeAttribute('data-holiday-theme')
      return
    }
    html.classList.add('holiday-on')
    html.setAttribute('data-holiday-theme', state.activeTheme)
    for (const [key, value] of Object.entries(look.vars)) {
      html.style.setProperty(key, value)
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta && look.themeColor) meta.setAttribute('content', look.themeColor)
  }, [state])

  if (!state?.look) return null
  const copy = COPY[locale] ?? COPY.vi
  return (
    <>
      {state.preview ? (
        <div
          data-pw-holiday-preview="1"
          className="flex items-center justify-between gap-3 bg-[var(--h-deep)] px-3 py-1.5 text-xs text-white"
        >
          <span>
            {state.look.preview} {copy.previewOnly.replace('{left}', remaining(state.previewExpiresAt))}
          </span>
        </div>
      ) : null}
      <div
        data-pw-holiday-ribbon="1"
        className="border-b border-[var(--h-gold-soft)] bg-[var(--h-paper)] px-3 py-2 text-[13px] text-[var(--h-ink)]"
      >
        <strong className="block">{state.look.ribbonTitle}</strong>
        <span>{state.look.ribbonBody}</span>
      </div>
    </>
  )
}
