'use client'

import { getPushVapidPublicKey, isStandalonePwa, urlBase64ToUint8Array } from '@/lib/pwa/push-subscribe-client'
import {
  isPartnerShopServiceWorkerScriptUrl,
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

/** Chrome / Firefox / Edge on iOS — PushManager may return FCM, but the OS never shows a toast. */
export function isIosNonSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return isIosDevice() && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent)
}

/**
 * Do not auto-subscribe here: iOS Safari in a tab, Chrome iOS, or desktop Chrome
 * with an iPhone user-agent. Those land FCM on the computer, not the phone PWA.
 */
export function partnerShopPushCannotAutoSubscribe(): boolean {
  if (isIosNonSafariBrowser()) return true
  return isIosDevice() && !isStandalonePwa()
}

function registrationScriptUrl(reg: ServiceWorkerRegistration): string {
  return reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || ''
}

async function waitForWorkerState(worker: ServiceWorker | null): Promise<void> {
  if (!worker) return
  if (worker.state === 'activated' || worker.state === 'redundant') return
  await new Promise<void>((resolve) => {
    const onChange = () => {
      if (worker.state === 'activated' || worker.state === 'redundant') {
        worker.removeEventListener('statechange', onChange)
        resolve()
      }
    }
    worker.addEventListener('statechange', onChange)
  })
}

/**
 * Shop origin must own `/` with the tenant SW (`/pw-shop-sw.js`, `/site/{slug}/sw.js`,
 * or custom-domain `/sw.js` rewrite). Leftover NanoAI `public/sw.js` on nanoai.vn
 * steals the scope: UI says subscribed, FCM delivers to a dead worker.
 * Android WebAPK stays bound to the script URL used at install — do not replace
 * an already-controlling shop `/sw.js` with `/pw-shop-sw.js`.
 */
export async function ensurePartnerShopServiceWorkerRegistration(
  siteSlug: string,
  customDomain: boolean
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  const startUrl = partnerSitePwaStartUrl(siteSlug, customDomain)
  const scope = partnerSitePwaScope(startUrl)
  const swHref = partnerSitePwaSwPath(siteSlug, customDomain)
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      regs.map(async (reg) => {
        const script = registrationScriptUrl(reg)
        if (!script || isPartnerShopServiceWorkerScriptUrl(script)) return
        try {
          const sub = await reg.pushManager.getSubscription()
          if (sub) await sub.unsubscribe()
        } catch {
          /* ignore */
        }
        try {
          await reg.unregister()
        } catch {
          /* ignore */
        }
      })
    )
    const remaining = await navigator.serviceWorker.getRegistrations()
    const shopReg = remaining.find((reg) => isPartnerShopServiceWorkerScriptUrl(registrationScriptUrl(reg)))
    const reg = shopReg || (await navigator.serviceWorker.register(swHref, { scope }))
    await waitForWorkerState(reg.installing)
    await waitForWorkerState(reg.waiting)
    try {
      await navigator.serviceWorker.ready
    } catch {
      /* ignore */
    }
    const ready = shopReg || (await navigator.serviceWorker.getRegistration(scope))
    if (ready && isPartnerShopServiceWorkerScriptUrl(registrationScriptUrl(ready))) return ready
    return isPartnerShopServiceWorkerScriptUrl(registrationScriptUrl(reg)) ? reg : null
  } catch (e) {
    console.warn('[shop-push] ensurePartnerShopServiceWorkerRegistration', e)
    return null
  }
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
  sendTest?: boolean
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('PushManager' in window)) {
    return false
  }
  if (Notification.permission !== 'granted') return false
  try {
    const vapidPublic = await resolveVapidPublicKey(input.siteSlug, input.authHeaders)
    if (!vapidPublic) return false
    const reg = await ensurePartnerShopServiceWorkerRegistration(input.siteSlug, input.customDomain)
    if (!reg) return false
    let sub = await reg.pushManager.getSubscription()
    let created = false
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
      })
      created = true
    }
    const json = sub.toJSON()
    const res = await fetch(partnerSitePushApiPath(input.siteSlug), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...input.authHeaders },
      body: JSON.stringify({ ...json, sendTest: Boolean(input.sendTest || created) }),
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

/** OS Settings toggle does not create a PushSubscription — POST when JS permission is already granted. */
export async function syncPartnerSitePushIfGranted(input: {
  siteSlug: string
  customDomain: boolean
  authHeaders: Record<string, string>
  sendTest?: boolean
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('PushManager' in window)) {
    return false
  }
  if (partnerShopPushCannotAutoSubscribe()) return false
  if (Notification.permission !== 'granted') return false
  return syncPartnerSitePushSubscription(input)
}

export async function requestPartnerSitePushPermissionAndSubscribe(input: {
  siteSlug: string
  customDomain: boolean
  authHeaders: Record<string, string>
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false
  return syncPartnerSitePushSubscription({ ...input, sendTest: true })
}
