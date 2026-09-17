'use client'

import { useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { isStandalonePwa } from '@/lib/pwa/push-subscribe-client'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  isIosDevice,
  isIosNonSafariBrowser,
  partnerShopPushCannotAutoSubscribe,
  requestPartnerSitePushPermissionAndSubscribe,
  syncPartnerSitePushSubscription,
} from '@/lib/partner-website/shop/partner-site-push-subscribe-client'
import { partnerSitePushApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

type Props = {
  siteSlug: string
  locale: WebLocale
}

export function PartnerSitePushEnableCard({ siteSlug, locale }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, isAuthenticated, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [busy, setBusy] = useState(false)
  const [configured, setConfigured] = useState(true)
  const [subscribed, setSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    const read = () => {
      if (typeof window === 'undefined' || !('Notification' in window) || !('PushManager' in window)) {
        setPermission('unsupported')
        return
      }
      setPermission(Notification.permission)
    }
    read()
    const onVis = () => {
      if (document.visibilityState === 'visible') read()
    }
    window.addEventListener('pageshow', read)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pageshow', read)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    if (!ready || !isAuthenticated) return
    let cancelled = false
    void fetch(partnerSitePushApiPath(siteSlug), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
      .then((res) => {
        captureFromResponse(res)
        return res.json()
      })
      .then((json: { configured?: boolean }) => {
        if (cancelled) return
        setConfigured(json.configured !== false)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [authHeaders, captureFromResponse, isAuthenticated, ready, siteSlug])

  useEffect(() => {
    if (!ready || !isAuthenticated || permission !== 'granted') return
    if (partnerShopPushCannotAutoSubscribe()) return
    // Always POST this device's endpoint. GET `subscribed` is account-wide — another
    // phone/tab (or a leftover NanoAI SW) must not skip registering the shop PWA here.
    void syncPartnerSitePushSubscription({
      siteSlug,
      customDomain,
      authHeaders: authHeaders(),
    }).then((ok) => {
      if (ok) setSubscribed(true)
    })
  }, [authHeaders, customDomain, isAuthenticated, permission, ready, siteSlug])

  if (!ready || !isAuthenticated) return null
  if (!configured) return null

  const chromeIos = isIosNonSafariBrowser()
  const iosNeedsPwa = !chromeIos && isIosDevice() && !isStandalonePwa()
  const unsupported = permission === 'unsupported' || chromeIos
  const denied = permission === 'denied'

  async function enable() {
    setBusy(true)
    try {
      const ok = await requestPartnerSitePushPermissionAndSubscribe({
        siteSlug,
        customDomain,
        authHeaders: authHeaders(),
      })
      if (typeof Notification !== 'undefined') setPermission(Notification.permission)
      setSubscribed(ok)
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setBusy(true)
    try {
      const ok = await syncPartnerSitePushSubscription({
        siteSlug,
        customDomain,
        authHeaders: authHeaders(),
        sendTest: true,
      })
      if (ok) setSubscribed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pw-shop-push-card">
      <h3>{t.pushEnableTitle}</h3>
      <p className="pw-shop-muted">{t.pushEnableHint}</p>
      {iosNeedsPwa ? <p className="pw-shop-muted">{t.pushIosHint}</p> : null}
      {chromeIos ? <p className="pw-shop-muted">{t.pushChromeIosHint}</p> : null}
      {unsupported && !chromeIos ? <p className="pw-shop-muted">{t.pushUnsupported}</p> : null}
      {denied ? <p className="pw-shop-muted">{t.pushDenied}</p> : null}
      {subscribed && permission === 'granted' && !iosNeedsPwa && !chromeIos ? (
        <>
          <p style={{ marginTop: 10, fontWeight: 600 }}>{t.pushEnabled}</p>
          <button
            type="button"
            className="pw-shop-btn"
            style={{ marginTop: 12 }}
            disabled={busy}
            onClick={() => void sendTest()}
          >
            {busy ? t.pushSyncing : t.pushTestButton}
          </button>
        </>
      ) : !unsupported && !denied && !iosNeedsPwa ? (
        <button type="button" className="pw-shop-btn" style={{ marginTop: 12 }} disabled={busy} onClick={() => void enable()}>
          {busy ? t.pushSyncing : t.pushEnableButton}
        </button>
      ) : null}
    </div>
  )
}
