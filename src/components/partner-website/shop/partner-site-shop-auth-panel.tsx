'use client'

import { useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'

type Props = {
  partnerSlug: string
  siteSlug: string
  locale: WebLocale
  onAuthed?: () => void
}

export function PartnerSiteShopAuthPanel({ partnerSlug, siteSlug, locale, onAuthed }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function requestOtp() {
    const em = email.trim().toLowerCase()
    if (!em || busy) return
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/auth/email/request`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email: em }),
      })
      captureFromResponse(res)
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setMessage(json.error || t.authFailed)
        return
      }
      setStep('otp')
      setMessage(t.authOtpSent)
    } finally {
      setBusy(false)
    }
  }

  async function verifyOtp() {
    const em = email.trim().toLowerCase()
    const code = otp.trim()
    if (!em || !code || busy) return
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/auth/email/verify-otp`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email: em, otp: code }),
      })
      captureFromResponse(res)
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setMessage(json.error || t.authFailed)
        return
      }
      setMessage(t.authSuccess)
      onAuthed?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pw-shop-form" style={{ marginTop: 16, padding: 16, border: '1px solid #e2e8f0', borderRadius: 12 }}>
      <p className="pw-shop-muted">{t.checkoutAuthRequired}</p>
      {step === 'email' ? (
        <>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@..." />
          </label>
          <button type="button" className="pw-shop-btn" disabled={busy} onClick={() => void requestOtp()}>
            {busy ? '…' : t.authSendOtp}
          </button>
        </>
      ) : (
        <>
          <label>
            OTP
            <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" />
          </label>
          <button type="button" className="pw-shop-btn" disabled={busy} onClick={() => void verifyOtp()}>
            {busy ? '…' : t.authVerifyOtp}
          </button>
        </>
      )}
      {message ? <p className="pw-shop-muted">{message}</p> : null}
    </div>
  )
}
