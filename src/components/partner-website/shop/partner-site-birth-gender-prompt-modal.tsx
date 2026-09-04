'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import {
  BIRTH_GENDER_PROMPT_COPY,
  birthGenderPromptLead,
} from '@/lib/partner-website/shop/partner-site-birth-gender-prompt'
import {
  clearPartnerSiteFreshLoginSession,
  dismissPartnerSiteBirthGenderPrompt,
  isPartnerSiteBirthGenderPromptDismissed,
  isPartnerSiteFreshLoginSession,
  isPartnerSiteShopLoginPath,
} from '@/lib/partner-website/shop/partner-site-birth-gender-prompt-session'
import { shouldPartnerSiteShopSkipAuthSync } from '@/lib/partner-website/shop/partner-site-shop-auth-skip-sync'
import { partnerSitePersonalizationApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import type { PartnerSiteVisitorProfile } from '@/lib/partner-website/shop/partner-site-personalization'
import {
  daysInCalendarMonth,
  isValidCalendarDate,
  parseDobParts,
  parsePartnerShopGender,
  partnerShopBirthYearOptions,
  partnerShopNeedsBirthOrGender,
  type PartnerShopGender,
} from '@/lib/partner-website/shop/partner-site-profile-demographics'

type Props = {
  siteSlug: string
  shopTitle?: string
  locale: WebLocale
}

export function PartnerSiteBirthGenderPromptModal({ siteSlug, shopTitle, locale }: Props) {
  const copy = BIRTH_GENDER_PROMPT_COPY[locale]
  const { authResolved, isAuthenticated, authHeaders, captureFromResponse } =
    usePartnerSiteGuestSession(siteSlug)
  const titleId = useId()
  const descId = useId()
  const firstDobRef = useRef<HTMLSelectElement>(null)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [gender, setGender] = useState<PartnerShopGender | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null)

  useEffect(() => {
    setReady(true)
  }, [])

  const handleDefer = useCallback(() => {
    dismissPartnerSiteBirthGenderPrompt(siteSlug)
    setOpen(false)
  }, [siteSlug])

  const applyProfile = useCallback((profile: PartnerSiteVisitorProfile) => {
    const parts = parseDobParts(profile.date_of_birth ?? '')
    setDobYear(parts?.year ?? '')
    setDobMonth(parts?.month ?? '')
    setDobDay(parts?.day ?? '')
    setGender(parsePartnerShopGender(profile.gender) ?? '')
    setError(null)
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!ready || !authResolved) return
    if (typeof window === 'undefined') return
    if (isPartnerSiteShopLoginPath(window.location.pathname)) return
    if (shouldPartnerSiteShopSkipAuthSync(siteSlug) || !isAuthenticated) return
    if (!isPartnerSiteFreshLoginSession(siteSlug)) return
    if (isPartnerSiteBirthGenderPromptDismissed(siteSlug)) {
      clearPartnerSiteFreshLoginSession(siteSlug)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(partnerSitePersonalizationApiPath(siteSlug, 'profile'), {
          credentials: 'same-origin',
          headers: authHeaders(),
        })
        captureFromResponse(res)
        const json = (await res.json().catch(() => ({}))) as {
          profile?: PartnerSiteVisitorProfile | null
        }
        if (cancelled) return
        const profile = json.profile ?? null
        if (!profile?.email || !partnerShopNeedsBirthOrGender(profile)) {
          clearPartnerSiteFreshLoginSession(siteSlug)
          return
        }
        applyProfile(profile)
      } catch {
        /* keep shopping; user can still fill account later */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [applyProfile, authHeaders, authResolved, captureFromResponse, isAuthenticated, ready, siteSlug])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => firstDobRef.current?.focus(), 100)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDefer()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [handleDefer, open])

  useEffect(() => {
    if (!dobYear || !dobMonth || !dobDay) return
    const y = Number.parseInt(dobYear, 10)
    const m = Number.parseInt(dobMonth, 10)
    const max = daysInCalendarMonth(y, m)
    const d = Number.parseInt(dobDay, 10)
    if (d > max) setDobDay(String(max).padStart(2, '0'))
  }, [dobDay, dobMonth, dobYear])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!dobYear || !dobMonth || !dobDay) {
      setError(copy.needDob)
      return
    }
    const y = Number.parseInt(dobYear, 10)
    const m = Number.parseInt(dobMonth, 10)
    const d = Number.parseInt(dobDay, 10)
    if (!isValidCalendarDate(y, m, d)) {
      setError(copy.invalidDob)
      return
    }
    const dobIso = `${dobYear}-${dobMonth}-${dobDay}`
    const dobDate = new Date(y, m - 1, d)
    const endToday = new Date()
    endToday.setHours(23, 59, 59, 999)
    if (dobDate > endToday) {
      setError(copy.futureDob)
      return
    }
    if (!gender) {
      setError(copy.needGender)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(partnerSitePersonalizationApiPath(siteSlug, 'profile'), {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ date_of_birth: dobIso, gender }),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || json.ok === false) {
        setError(json.error === 'DOB_INVALID' ? copy.invalidDob : copy.saveFailed)
        return
      }
      clearPartnerSiteFreshLoginSession(siteSlug)
      setOpen(false)
      setToast({ title: copy.savedTitle, body: copy.savedBody })
    } catch {
      setError(copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  if (!ready || typeof document === 'undefined') return null

  const yearOptions = partnerShopBirthYearOptions()
  const maxDays =
    dobYear && dobMonth
      ? daysInCalendarMonth(Number.parseInt(dobYear, 10), Number.parseInt(dobMonth, 10))
      : 31

  return createPortal(
    <>
      {open ? (
        <div
          data-pw-birth-gender-prompt="1"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <button
            type="button"
            data-pw-birth-gender-backdrop
            aria-label={copy.close}
            onClick={handleDefer}
          />
          <div data-pw-birth-gender-card>
            <h2 data-pw-birth-gender-title id={titleId}>
              {copy.title}
            </h2>
            <p data-pw-birth-gender-lead id={descId}>
              {birthGenderPromptLead(locale, shopTitle)}
            </p>
            <form data-pw-birth-gender-form onSubmit={(ev) => void handleSubmit(ev)}>
              <fieldset>
                <legend data-pw-birth-gender-legend>{copy.dobLegend}</legend>
                <div data-pw-birth-gender-dob>
                  <div>
                    <label htmlFor="pw-sale-prompt-dob-day" className="sr-only">
                      {copy.day}
                    </label>
                    <select
                      ref={firstDobRef}
                      id="pw-sale-prompt-dob-day"
                      value={dobDay}
                      onChange={(ev) => setDobDay(ev.target.value)}
                    >
                      <option value="">{copy.day}</option>
                      {Array.from({ length: maxDays }, (_, i) => {
                        const dayNum = i + 1
                        const val = String(dayNum).padStart(2, '0')
                        return (
                          <option key={val} value={val}>
                            {dayNum}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="pw-sale-prompt-dob-month" className="sr-only">
                      {copy.month}
                    </label>
                    <select
                      id="pw-sale-prompt-dob-month"
                      value={dobMonth}
                      onChange={(ev) => setDobMonth(ev.target.value)}
                    >
                      <option value="">{copy.month}</option>
                      {copy.monthLabels.map((label, i) => {
                        const val = String(i + 1).padStart(2, '0')
                        return (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="pw-sale-prompt-dob-year" className="sr-only">
                      {copy.year}
                    </label>
                    <select
                      id="pw-sale-prompt-dob-year"
                      value={dobYear}
                      onChange={(ev) => setDobYear(ev.target.value)}
                    >
                      <option value="">{copy.year}</option>
                      {yearOptions.map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </fieldset>
              <div>
                <span data-pw-birth-gender-label>{copy.gender}</span>
                <div data-pw-birth-gender-genders>
                  {(
                    [
                      { v: 'male' as const, label: copy.male },
                      { v: 'female' as const, label: copy.female },
                    ] as const
                  ).map(({ v, label }) => (
                    <button
                      key={v}
                      type="button"
                      data-pw-birth-gender-gender={v}
                      aria-pressed={gender === v}
                      onClick={() => setGender(v)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {error ? (
                <p data-pw-birth-gender-error role="alert">
                  {error}
                </p>
              ) : null}
              <div data-pw-birth-gender-actions>
                <button type="button" data-pw-birth-gender-defer onClick={handleDefer}>
                  {copy.defer}
                </button>
                <button type="submit" data-pw-birth-gender-save disabled={saving}>
                  {copy.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div data-pw-birth-gender-toast role="status">
          <strong>{toast.title}</strong>
          {toast.body}
        </div>
      ) : null}
    </>,
    document.body
  )
}
