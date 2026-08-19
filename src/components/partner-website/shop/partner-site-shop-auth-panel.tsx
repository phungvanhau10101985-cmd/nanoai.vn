'use client'

import { useCallback, useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { signInWithGoogle } from '@/app/auth/actions'
import { PARTNER_SITE_CUSTOMER_TOKEN_QUERY_KEY } from '@/lib/messaging/partner-site-customer-auth-constants'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  authPartnerSiteFromShopToken,
  tryPartnerSiteQuickAuth,
} from '@/lib/partner-website/shop/partner-site-shop-quick-auth'
import {
  fetchPartnerSiteShopSsoConfig,
  type PartnerSiteShopSsoConfig,
} from '@/lib/partner-website/shop/partner-site-shop-sso'
import {
  buildShopGoogleAuthBridgeUrl,
  PARTNER_SITE_GOOGLE_AUTH_HANDOFF_QUERY_KEY,
} from '@/lib/partner-website/shop/partner-site-google-auth-handoff-client'
import {
  clearPartnerSiteShopSkipAuthSync,
  shouldPartnerSiteShopSkipAuthSync,
} from '@/lib/partner-website/shop/partner-site-shop-auth-skip-sync'
import { partnerSiteAccountPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  readGuestAuthRememberDevicePreference,
  writeGuestAuthRememberDevicePreference,
} from '@/lib/auth/guest-auth-remember-device-client'
import { getStableEmailTrustedBrowserId } from '@/lib/auth/email-trusted-browser-client'

type Props = {
  partnerSlug: string
  siteSlug: string
  shopTitle?: string
  locale: WebLocale
  onAuthed?: () => void
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function PartnerSiteShopAuthPanel({ partnerSlug, siteSlug, shopTitle, locale, onAuthed }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const onCustomDomain = usePartnerSiteCustomDomain()
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [returnNext, setReturnNext] = useState(partnerSiteAccountPath(siteSlug))
  const [shopReturnHref, setShopReturnHref] = useState('')

  const [rememberDevice, setRememberDevice] = useState(() => readGuestAuthRememberDevicePreference())
  const [ssoConfig, setSsoConfig] = useState<PartnerSiteShopSsoConfig | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setReturnNext(`${window.location.pathname}${window.location.search}`)
    setShopReturnHref(window.location.href.split('#')[0])
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchPartnerSiteShopSsoConfig(siteSlug)
      .then((cfg) => {
        if (!cancelled && cfg) setSsoConfig(cfg)
      })
      .catch(() => {
        // optional — OTP vẫn hoạt động
      })
    return () => {
      cancelled = true
    }
  }, [siteSlug])

  const tryQuickLogin = useCallback(async (): Promise<boolean> => {
    if (shouldPartnerSiteShopSkipAuthSync(siteSlug)) return false
    const result = await tryPartnerSiteQuickAuth({
      partnerSlug,
      siteSlug,
      authHeaders,
      captureFromResponse,
      shopOrigin: ssoConfig?.shopOrigin,
      customerTokenPath: ssoConfig?.customerTokenPath,
      customerTokenOnShopDomain: ssoConfig?.customerTokenOnShopDomain,
    })
    if (result.ok) {
      onAuthed?.()
      return true
    }
    return false
  }, [authHeaders, captureFromResponse, onAuthed, partnerSlug, siteSlug, ssoConfig])

  const consumePcTokenFromUrl = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false
    const sp = new URLSearchParams(window.location.search)
    const pcToken = sp.get(PARTNER_SITE_CUSTOMER_TOKEN_QUERY_KEY)?.trim() ?? ''
    if (!pcToken) return false
    clearPartnerSiteShopSkipAuthSync(siteSlug)
    const ok = await authPartnerSiteFromShopToken({
      partnerSlug,
      token: pcToken,
      authHeaders,
      captureFromResponse,
    })
    sp.delete(PARTNER_SITE_CUSTOMER_TOKEN_QUERY_KEY)
    const nextPath = `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ''}`
    window.history.replaceState(null, '', nextPath)
    if (ok) onAuthed?.()
    return ok
  }, [authHeaders, captureFromResponse, onAuthed, partnerSlug, siteSlug])

  const consumeGoogleHandoffFromUrl = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false
    const sp = new URLSearchParams(window.location.search)
    const token = sp.get(PARTNER_SITE_GOOGLE_AUTH_HANDOFF_QUERY_KEY)?.trim() ?? ''
    if (!token) return false
    clearPartnerSiteShopSkipAuthSync(siteSlug)
    try {
      const res = await fetch(`/api/site/${encodeURIComponent(siteSlug)}/auth/handoff`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ token }),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean }
      sp.delete(PARTNER_SITE_GOOGLE_AUTH_HANDOFF_QUERY_KEY)
      sp.delete('meta_complete_registration')
      const nextPath = `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ''}`
      window.history.replaceState(null, '', nextPath)
      if (res.ok && json.ok) {
        onAuthed?.()
        return true
      }
    } catch {
      /* stay on form */
    }
    return false
  }, [authHeaders, captureFromResponse, onAuthed, siteSlug])

  useEffect(() => {
    if (!ready) return
    void (async () => {
      if (await consumeGoogleHandoffFromUrl()) return
      if (await consumePcTokenFromUrl()) return
      await tryQuickLogin().catch(() => {
        // stay on login form
      })
    })()
  }, [ready, consumeGoogleHandoffFromUrl, consumePcTokenFromUrl, tryQuickLogin])

  const showGoogleButton = Boolean(ssoConfig?.platformGoogleAuthEnabled)
  /** Domain khách: cookie OAuth phải gắn trên NanoAI → bridge `/auth/shop-google`. */
  const useBridgeGoogle = onCustomDomain

  function beginGoogleLogin() {
    clearPartnerSiteShopSkipAuthSync(siteSlug)
  }

  function handleBridgeGoogleLogin() {
    if (busy || !ready || !ssoConfig?.platformAuthOrigin) return
    beginGoogleLogin()
    const returnUrl = shopReturnHref || (typeof window !== 'undefined' ? window.location.href.split('#')[0] : '')
    if (!returnUrl) return
    setBusy(true)
    window.location.href = buildShopGoogleAuthBridgeUrl({
      platformOrigin: ssoConfig.platformAuthOrigin,
      siteSlug,
      shopReturnUrl: returnUrl,
      nextPath: partnerSiteAccountPath(siteSlug),
    })
  }

  async function requestOtp() {
    const em = email.trim().toLowerCase()
    if (busy || !ready) return
    if (!em) {
      setMessage(t.authEmailRequired)
      return
    }
    if (!isValidEmail(em)) {
      setMessage(t.authFailed)
      return
    }
    setBusy(true)
    setMessage('')
    beginGoogleLogin()
    const browserId = getStableEmailTrustedBrowserId()
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/auth/email/request`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          email: em,
          rememberDevice,
          browserId,
          accountOrigin: 'customer_website',
        }),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; autoSignedIn?: boolean }
      if (!res.ok || !json.ok) {
        setMessage(json.error || t.authFailed)
        return
      }
      if (json.autoSignedIn) {
        setMessage(t.authSuccess)
        onAuthed?.()
        return
      }
      setStep('otp')
      setMessage(t.authOtpSent)
    } catch {
      setMessage(t.authFailed)
    } finally {
      setBusy(false)
    }
  }

  async function verifyOtp() {
    const em = email.trim().toLowerCase()
    const code = otp.trim()
    if (busy || !ready) return
    if (!code) {
      setMessage(t.authFailed)
      return
    }
    setBusy(true)
    setMessage('')
    beginGoogleLogin()
    const browserId = getStableEmailTrustedBrowserId()
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/auth/email/verify-otp`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          email: em,
          otp: code,
          rememberDevice,
          browserId,
          accountOrigin: 'customer_website',
        }),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setMessage(json.error || t.authFailed)
        return
      }
      setMessage(t.authSuccess)
      onAuthed?.()
    } catch {
      setMessage(t.authFailed)
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <div className="pw-shop-auth-panel pw-shop-form">
        <p className="pw-shop-muted">…</p>
      </div>
    )
  }

  if (step === 'otp') {
    return (
      <div className="pw-shop-auth-panel pw-shop-form">
        <p className="pw-shop-auth-panel-intro">{t.checkoutAuthRequired}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void verifyOtp()
          }}
        >
          <p className="pw-shop-muted">
            {t.accountEmailLabel}: {email}
          </p>
          <label>
            OTP
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </label>
          <button type="submit" className="pw-shop-btn" disabled={busy}>
            {busy ? '…' : t.authVerifyOtp}
          </button>
          <button
            type="button"
            className="pw-shop-btn pw-shop-btn-outline"
            disabled={busy}
            onClick={() => {
              setStep('email')
              setOtp('')
              setMessage('')
            }}
          >
            {t.authChangeEmail}
          </button>
        </form>
        {message ? <p className="pw-shop-muted">{message}</p> : null}
      </div>
    )
  }

  return (
    <div className="pw-shop-auth-panel pw-shop-form">
      <p className="pw-shop-auth-panel-intro">{t.checkoutAuthRequired}</p>
      {shopTitle ? <p className="pw-shop-auth-panel-welcome">{shopTitle}</p> : null}
      <p className="pw-shop-auth-panel-hint">{t.authLoginSubtitle}</p>

      {showGoogleButton ? (
        useBridgeGoogle ? (
          <button
            type="button"
            className="pw-shop-btn-google"
            disabled={busy || !ssoConfig?.platformAuthOrigin}
            onClick={handleBridgeGoogleLogin}
          >
            <GoogleIcon />
            <span>{t.authGoogleLogin}</span>
          </button>
        ) : (
          <form action={signInWithGoogle} onSubmit={beginGoogleLogin}>
            <input type="hidden" name="next" value={returnNext} />
            <button type="submit" className="pw-shop-btn-google" disabled={busy}>
              <GoogleIcon />
              <span>{t.authGoogleLogin}</span>
            </button>
          </form>
        )
      ) : null}

      {showGoogleButton ? (
        <div className="pw-shop-auth-divider">
          <span>{t.authShopOtpOr}</span>
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void requestOtp()
        }}
      >
        <label>
          {t.accountEmailLabel}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            autoComplete="email"
            required
          />
        </label>
        <label className="pw-shop-auth-panel-check">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => {
              const next = e.target.checked
              setRememberDevice(next)
              writeGuestAuthRememberDevicePreference(next)
            }}
          />
          <span>{t.authRememberDevice}</span>
        </label>
        <button type="submit" className="pw-shop-btn pw-shop-btn-outline pw-shop-btn-send-otp" disabled={busy}>
          {busy ? '…' : t.authSendOtp}
        </button>
      </form>
      {message ? <p className="pw-shop-muted">{message}</p> : null}
    </div>
  )
}
