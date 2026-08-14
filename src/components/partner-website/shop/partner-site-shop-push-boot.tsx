'use client'

import { useEffect } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  partnerSitePwaScope,
  partnerSitePwaStartUrl,
  partnerSitePwaSwPath,
} from '@/lib/partner-website/shop/partner-site-pwa'
import { isStandalonePwa } from '@/lib/pwa/push-subscribe-client'
import {
  isIosDevice,
  PW_SHOP_NOTIFICATIONS_REFRESH_EVENT,
  requestPartnerSitePushPermissionAndSubscribe,
  syncPartnerSitePushSubscription,
} from '@/lib/partner-website/shop/partner-site-push-subscribe-client'

/** Registers shop SW + Web Push on every /site/{slug} page, including HTML landing. */
export function PartnerSiteShopPushBoot({ siteSlug }: { siteSlug: string }) {
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, isAuthenticated, authHeaders } = usePartnerSiteGuestSession(siteSlug)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const startUrl = partnerSitePwaStartUrl(siteSlug, customDomain)
    const swHref = partnerSitePwaSwPath(siteSlug, customDomain)
    void navigator.serviceWorker
      .register(swHref, { scope: partnerSitePwaScope(startUrl) })
      .catch(() => undefined)
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
    const headers = authHeaders()
    if (Notification.permission === 'granted') {
      const timer = window.setTimeout(() => {
        void syncPartnerSitePushSubscription({ siteSlug, customDomain, authHeaders: headers })
      }, 4000)
      return () => window.clearTimeout(timer)
    }
    if (Notification.permission !== 'default') return
    if (isIosDevice() && !isStandalonePwa()) return
    const promptKey = 'pw_shop_push_prompt_v1'
    try {
      if (window.sessionStorage.getItem(promptKey)) return
    } catch {
      return
    }
    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(promptKey, '1')
      } catch {
        /* ignore quota */
      }
      void requestPartnerSitePushPermissionAndSubscribe({
        siteSlug,
        customDomain,
        authHeaders: headers,
      })
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [authHeaders, customDomain, isAuthenticated, ready, siteSlug])

  return null
}
