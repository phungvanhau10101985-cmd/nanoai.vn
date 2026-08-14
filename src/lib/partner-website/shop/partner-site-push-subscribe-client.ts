'use client'

import { getPushVapidPublicKey, urlBase64ToUint8Array } from '@/lib/pwa/push-subscribe-client'
import {
  partnerSitePwaScope,
  partnerSitePwaStartUrl,
  partnerSitePwaSwPath,
} from '@/lib/partner-website/shop/partner-site-pwa'
import { partnerSitePushApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export const PW_SHOP_NOTIFICATIONS_REFRESH_EVENT = 'pw-shop-notifications-refresh'

export function dispatchPartnerShopNotificationsRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PW_SHOP_NOTIFICATIONS_REFRESH_EVENT))
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
}

async function shopServiceWorkerRegistration(
  siteSlug: string,
  customDomain: boolean
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  const startUrl = partnerSitePwaStartUrl(siteSlug, customDomain)
  const scope = partnerSitePwaScope(startUrl)
  const swHref = partnerSitePwaSwPath(siteSlug, customDomain)
  const existing = await navigator.serviceWorker.getRegistration(scope)
  if (existing) return existing
  return navigator.serviceWorker.register(swHref, { scope })
}

async function resolveVapidPublicKey(
  siteSlug: string,
  authHeaders: Record<string, string>
): Promise<string> {
  const fromEnv = getPushVapidPublicKey()
  try {
    const res = await fetch(partnerSitePushApiPath(siteSlug), {
      credentials: 'same-origin',
      headers: authHeaders,
    })
    const json = (await res.json().catch(() => ({}))) as { publicKey?: string; configured?: boolean }
    const key = json.publicKey?.trim() || fromEnv || ''
    return json.configured === false ? '' : key
  } catch {
    return fromEnv || ''
  }
}

export async function syncPartnerSitePushSubscription(input: {
  siteSlug: string
  customDomain: boolean
  authHeaders: Record<string, string>
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('PushManager' in window)) {
    return false
  }
  if (Notification.permission !== 'granted') return false
  try {
    const vapidPublic = await resolveVapidPublicKey(input.siteSlug, input.authHeaders)
    if (!vapidPublic) return false
    const reg = await shopServiceWorkerRegistration(input.siteSlug, input.customDomain)
    if (!reg) return false
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
      })
    }
    const json = sub.toJSON()
    const res = await fetch(partnerSitePushApiPath(input.siteSlug), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...input.authHeaders },
      body: JSON.stringify(json),
    })
    if (!res.ok) {
      console.warn('[shop-push] subscribe failed', res.status)
      return false
    }
    dispatchPartnerShopNotificationsRefresh()
    return true
  } catch (e) {
    console.warn('[shop-push] syncPartnerSitePushSubscription', e)
    return false
  }
}

export async function requestPartnerSitePushPermissionAndSubscribe(input: {
  siteSlug: string
  customDomain: boolean
  authHeaders: Record<string, string>
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false
  return syncPartnerSitePushSubscription(input)
}
