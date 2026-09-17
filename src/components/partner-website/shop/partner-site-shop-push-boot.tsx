'use client'

import { useEffect } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  ensurePartnerShopServiceWorkerRegistration,
  PW_SHOP_NOTIFICATIONS_REFRESH_EVENT,
  syncPartnerSitePushIfGranted,
} from '@/lib/partner-website/shop/partner-site-push-subscribe-client'

/** Registers shop SW + Web Push on every /site/{slug} page, including HTML landing. */
export function PartnerSiteShopPushBoot({ siteSlug }: { siteSlug: string }) {
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, isAuthenticated, authHeaders } = usePartnerSiteGuestSession(siteSlug)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    void ensurePartnerShopServiceWorkerRegistration(siteSlug, customDomain)
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PW_SHOP_NOTIFICATIONS_REFRESH') {
        window.dispatchEvent(new Event(PW_SHOP_NOTIFICATIONS_REFRESH_EVENT))
      }
    }
    navigator.serviceWorker.addEventListener('message', onSwMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage)
  }, [customDomain, siteSlug])

  useEffect(() => {
    if (!ready || !isAuthenticated) return
    if (typeof window === 'undefined' || !('Notification' in window) || !('PushManager' in window)) return
    const run = () => {
      if (document.visibilityState === 'hidden') return
      void syncPartnerSitePushIfGranted({
        siteSlug,
        customDomain,
        authHeaders: authHeaders(),
      })
    }
    run()
    const onVis = () => {
      if (document.visibilityState === 'visible') run()
    }
    window.addEventListener('pageshow', run)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pageshow', run)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [authHeaders, customDomain, isAuthenticated, ready, siteSlug])

  return null
}
