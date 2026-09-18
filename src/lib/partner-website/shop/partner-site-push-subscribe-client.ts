'use client'

import { getPushVapidPublicKey, isStandalonePwa, urlBase64ToUint8Array } from '@/lib/pwa/push-subscribe-client'
import {
  isPartnerShopServiceWorkerScriptUrl,
  partnerShopServiceWorkerSourceIsShop,
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

export function partnerShopPushOptOutStorageKey(siteSlug: string): string {
  return `pw_shop_push_opt_out_v1:${siteSlug.trim().toLowerCase()}`
}

export function partnerShopPushUserOptedOut(siteSlug: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(partnerShopPushOptOutStorageKey(siteSlug)) === '1'
  } catch {
    return false
  }
}

export function setPartnerShopPushUserOptedOut(siteSlug: string, optedOut: boolean): void {
  if (typeof window === 'undefined') return
  try {
    const key = partnerShopPushOptOutStorageKey(siteSlug)
    if (optedOut) window.localStorage.setItem(key, '1')
    else window.localStorage.removeItem(key)
  } catch {
    /* ignore quota */
  }
}

function registrationScriptUrl(reg: ServiceWorkerRegistration): string {
  return reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || ''
}

async function registrationScriptIsShopWorker(script: string): Promise<boolean> {
  if (!script) return false
  try {
    const res = await fetch(script, { cache: 'no-store' })
    const text = await res.text()
    return partnerShopServiceWorkerSourceIsShop(text)
  } catch {
    return isPartnerShopServiceWorkerScriptUrl(script)
  }
}

async function unregisterPushRegistration(reg: ServiceWorkerRegistration): Promise<void> {
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
        if (!script) return
        if (await registrationScriptIsShopWorker(script)) return
        await unregisterPushRegistration(reg)
      })
    )
    const remaining = await navigator.serviceWorker.getRegistrations()
    let shopReg: ServiceWorkerRegistration | undefined
    for (const reg of remaining) {
      if (await registrationScriptIsShopWorker(registrationScriptUrl(reg))) {
        shopReg = reg
        break
      }
    }
    const reg = shopReg || (await navigator.serviceWorker.register(swHref, { scope }))
    await waitForWorkerState(reg.installing)
    await waitForWorkerState(reg.waiting)
    try {
      await navigator.serviceWorker.ready
    } catch {
      /* ignore */
    }
    const ready = shopReg || (await navigator.serviceWorker.getRegistration(scope))
    if (ready && (await registrationScriptIsShopWorker(registrationScriptUrl(ready)))) return ready
    return (await registrationScriptIsShopWorker(registrationScriptUrl(reg))) ? reg : null
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
      body: JSON.stringify({ ...json, sendTest: Boolean(input.sendTest) }),
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

/** Default ON: request permission on shop PWA / Android, then subscribe. Respects user opt-out. */
export async function ensurePartnerSitePushDefaultOn(input: {
  siteSlug: string
  customDomain: boolean
  authHeaders: Record<string, string>
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('PushManager' in window)) {
    return false
  }
  if (partnerShopPushCannotAutoSubscribe()) return false
  if (partnerShopPushUserOptedOut(input.siteSlug)) return false
  if (Notification.permission === 'denied') return false
  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return false
  }
  setPartnerShopPushUserOptedOut(input.siteSlug, false)
  return syncPartnerSitePushSubscription(input)
}

export async function disablePartnerSitePush(input: {
  siteSlug: string
  customDomain: boolean
  authHeaders: Record<string, string>
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false
  setPartnerShopPushUserOptedOut(input.siteSlug, true)
  try {
    const reg = await ensurePartnerShopServiceWorkerRegistration(input.siteSlug, input.customDomain)
    const sub = await reg?.pushManager.getSubscription()
    const endpoint = sub?.endpoint
    if (endpoint) {
      await fetch(partnerSitePushApiPath(input.siteSlug), {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...input.authHeaders },
        body: JSON.stringify({ endpoint }),
      })
    }
    if (sub) await sub.unsubscribe()
    dispatchPartnerShopNotificationsRefresh()
    return true
  } catch (e) {
    console.warn('[shop-push] disablePartnerSitePush', e)
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
  return ensurePartnerSitePushDefaultOn(input)
}

export async function requestPartnerSitePushPermissionAndSubscribe(input: {
  siteSlug: string
  customDomain: boolean
  authHeaders: Record<string, string>
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  setPartnerShopPushUserOptedOut(input.siteSlug, false)
  const perm =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (perm !== 'granted') return false
  return syncPartnerSitePushSubscription({ ...input, sendTest: true })
}
