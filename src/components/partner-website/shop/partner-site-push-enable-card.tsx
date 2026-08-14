'use client'

import { useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { isStandalonePwa } from '@/lib/pwa/push-subscribe-client'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  isIosDevice,
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
    if (typeof window === 'undefined' || !('Notification' in window) || !('PushManager' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)
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
      .then((json: { configured?: boolean; subscribed?: boolean }) => {
        if (cancelled) return
        setConfigured(json.configured !== false)
        setSubscribed(Boolean(json.subscribed))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [authHeaders, captureFromResponse, isAuthenticated, ready, siteSlug])

  useEffect(() => {
    if (!ready || !isAuthenticated || permission !== 'granted' || subscribed) return
    void syncPartnerSitePushSubscription({
      siteSlug,
      customDomain,
      authHeaders: authHeaders(),
    }).then((ok) => {
      if (ok) setSubscribed(true)
    })
  }, [authHeaders, customDomain, isAuthenticated, permission, ready, siteSlug, subscribed])

  if (!ready || !isAuthenticated) return null
  if (!configured) return null

  const iosNeedsPwa = isIosDevice() && !isStandalonePwa()
  const unsupported = permission === 'unsupported'
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

  return (
    <div className="pw-shop-push-card">
      <h3>{t.pushEnableTitle}</h3>
      <p className="pw-shop-muted">{t.pushEnableHint}</p>
      {iosNeedsPwa ? <p className="pw-shop-muted">{t.pushIosHint}</p> : null}
      {unsupported ? <p className="pw-shop-muted">{t.pushUnsupported}</p> : null}
      {denied ? <p className="pw-shop-muted">{t.pushDenied}</p> : null}
      {subscribed && permission === 'granted' ? (
        <p style={{ marginTop: 10, fontWeight: 600 }}>{t.pushEnabled}</p>
      ) : !unsupported && !denied && !iosNeedsPwa ? (
        <button type="button" className="pw-shop-btn" style={{ marginTop: 12 }} disabled={busy} onClick={() => void enable()}>
          {busy ? t.pushSyncing : t.pushEnableButton}
        </button>
      ) : null}
    </div>
  )
}
