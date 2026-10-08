'use client'

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
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
} from '@/lib/partner-website/shop/partner-site-google-auth-handoff-client'
import {
  clearPartnerSiteShopSkipAuthSync,
  shouldPartnerSiteShopSkipAuthSync,
} from '@/lib/partner-website/shop/partner-site-shop-auth-skip-sync'
import { partnerSiteAccountPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  getPartnerShopLoginRedirectFromUrl,
  partnerShopOAuthNextPath,
  partnerShopReturnAbsoluteHref,
} from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import {
  readGuestAuthRememberDevicePreference,
  writeGuestAuthRememberDevicePreference,
} from '@/lib/auth/guest-auth-remember-device-client'
import { getStableEmailTrustedBrowserId } from '@/lib/auth/email-trusted-browser-client'
import { markPartnerSiteFreshLoginSession } from '@/lib/partner-website/shop/partner-site-birth-gender-prompt-session'
import { getWebmailInfo } from '@/lib/auth/email-webmail-helper'

type Props = {
  partnerSlug: string
  siteSlug: string
  shopTitle?: string
  locale: WebLocale
  onAuthed?: () => void
  /** Dedicated `/login` page — hide checkout-style intro (title lives on the page). */
  pageMode?: boolean
  /** Server-known Google OAuth — hiện nút ngay, không chờ GET shop-sso. */
  googleAuthEnabled?: boolean
  platformAuthOrigin?: string
  shopRequestOrigin?: string
  initialReturnDest?: string
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

function GoogleMailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M12 13L2 6.5V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6.5L12 13z" />
      <path fill="#4285F4" d="M22 6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v.5L12 13l10-6.5V6z" />
    </svg>
  )
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function PartnerSiteShopAuthPanel({
  partnerSlug,
  siteSlug,
  shopTitle,
  locale,
  onAuthed,
  pageMode,
  googleAuthEnabled,
  platformAuthOrigin,
  shopRequestOrigin,
  initialReturnDest,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const authErrorMessage = (error: string | undefined) =>
    error === 'ACCOUNT_LOCKED' ? t.authAccountLocked : error || t.authFailed
  const onCustomDomain = usePartnerSiteCustomDomain()
  const { authResolved, isAuthenticated, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [returnDest, setReturnDest] = useState(
    initialReturnDest || partnerSiteAccountPath(siteSlug)
  )

  const [rememberDevice, setRememberDevice] = useState(() => readGuestAuthRememberDevicePreference())
  const [ssoConfig, setSsoConfig] = useState<PartnerSiteShopSsoConfig | null>(null)

  useLayoutEffect(() => {
    setReturnDest(getPartnerShopLoginRedirectFromUrl(siteSlug, { customDomain: onCustomDomain }))
  }, [onCustomDomain, siteSlug])

  const oauthNext = partnerShopOAuthNextPath(siteSlug, returnDest, { customDomain: onCustomDomain })
  const showGoogleButton = googleAuthEnabled ?? ssoConfig?.platformGoogleAuthEnabled ?? true
  const bridgeOrigin = (platformAuthOrigin || ssoConfig?.platformAuthOrigin || '').replace(/\/$/, '')

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
      skipResumeAndSync: true,
    })
    if (result.ok) {
      markPartnerSiteFreshLoginSession(siteSlug)
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
    if (ok) {
      markPartnerSiteFreshLoginSession(siteSlug)
      onAuthed?.()
    }
    return ok
  }, [authHeaders, captureFromResponse, onAuthed, partnerSlug, siteSlug])

  useLayoutEffect(() => {
    void (async () => {
      if (await consumePcTokenFromUrl()) return
      if (!authResolved) return
      if (isAuthenticated) {
        onAuthed?.()
        return
      }
      await tryQuickLogin().catch(() => {
        // stay on login form
      })
    })()
  }, [
    authResolved,
    consumePcTokenFromUrl,
    isAuthenticated,
    onAuthed,
    siteSlug,
    tryQuickLogin,
  ])

  const showGoogleButtonResolved = Boolean(showGoogleButton)
  /** Domain khách: cookie OAuth phải gắn trên NanoAI → bridge `/auth/shop-google`. */
  const useBridgeGoogle = onCustomDomain
  const bridgeGoogleHref = (() => {
    if (!useBridgeGoogle || !bridgeOrigin) return ''
    let returnUrl = ''
    if (shopRequestOrigin) {
      try {
        returnUrl = new URL(returnDest, `${shopRequestOrigin.replace(/\/$/, '')}/`).href
      } catch {
        returnUrl = ''
      }
    }
    if (!returnUrl) returnUrl = partnerShopReturnAbsoluteHref(siteSlug, returnDest)
    if (!returnUrl) return ''
    return buildShopGoogleAuthBridgeUrl({
      platformOrigin: bridgeOrigin,
      siteSlug,
      shopReturnUrl: returnUrl,
      nextPath: oauthNext,
    })
  })()

  function beginGoogleLogin() {
    clearPartnerSiteShopSkipAuthSync(siteSlug)
  }

  async function requestOtp() {
    const em = email.trim().toLowerCase()
    if (busy || !authResolved) return
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
        setMessage(authErrorMessage(json.error))
        return
      }
      if (json.autoSignedIn) {
        setMessage(t.authSuccess)
        markPartnerSiteFreshLoginSession(siteSlug)
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
    if (busy) return
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
        setMessage(authErrorMessage(json.error))
        return
      }
      setMessage(t.authSuccess)
      markPartnerSiteFreshLoginSession(siteSlug)
      onAuthed?.()
    } catch {
      setMessage(t.authFailed)
    } finally {
      setBusy(false)
    }
  }

  if (step === 'otp') {
    const webmail = getWebmailInfo(email)
    return (
      <div className="pw-shop-auth-panel pw-shop-form">
        {pageMode ? null : <p className="pw-shop-auth-panel-intro">{t.checkoutAuthRequired}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void verifyOtp()
          }}
        >
          <p className="pw-shop-muted">
            {t.accountEmailLabel}: <strong>{email}</strong>
          </p>

          <div
            style={{
              margin: '12px 0 16px',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#991b1b',
              fontSize: '13px',
              lineHeight: 1.45,
            }}
          >
            <p style={{ margin: '0 0 10px 0', fontWeight: 600 }}>
              {t.authCheckEmailSpamTrashHint}
            </p>
            <a
              href={webmail.url}
              target="_blank"
              rel="noopener noreferrer"
              className="pw-shop-btn pw-shop-btn-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                textDecoration: 'none',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 600,
                background: '#ffffff',
                borderColor: '#fca5a5',
                color: '#dc2626',
              }}
            >
              <GoogleMailIcon />
              <span>{webmail.isGmail ? t.authOpenGmail : t.authOpenMailbox}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>

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
      {pageMode ? null : <p className="pw-shop-auth-panel-intro">{t.checkoutAuthRequired}</p>}
      {pageMode ? null : shopTitle ? <p className="pw-shop-auth-panel-welcome">{shopTitle}</p> : null}
      {pageMode ? null : <p className="pw-shop-auth-panel-hint">{t.authLoginSubtitle}</p>}

      {showGoogleButtonResolved ? (
        useBridgeGoogle ? (
          <a
            className="pw-shop-btn-google"
            href={bridgeGoogleHref || undefined}
            aria-disabled={!bridgeGoogleHref || busy}
            onClick={beginGoogleLogin}
          >
            <GoogleIcon />
            <span>{t.authGoogleLogin}</span>
          </a>
        ) : (
          <form action={signInWithGoogle} onSubmit={beginGoogleLogin}>
            <input type="hidden" name="next" value={oauthNext} />
            <button type="submit" className="pw-shop-btn-google" disabled={busy}>
              <GoogleIcon />
              <span>{t.authGoogleLogin}</span>
            </button>
          </form>
        )
      ) : null}

      {showGoogleButtonResolved ? (
        <div className="pw-shop-auth-divider">
          <span>{t.authShopOtpOr}</span>
        </div>
      ) : null}

      <p className="pw-shop-auth-panel-welcome">{t.authEmailLogin}</p>
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
        <button type="submit" className="pw-shop-btn pw-shop-btn-outline pw-shop-btn-send-otp" disabled={busy || !authResolved}>
          {busy ? '…' : t.authSendOtp}
        </button>
      </form>
      {message ? <p className="pw-shop-muted">{message}</p> : null}
    </div>
  )
}
