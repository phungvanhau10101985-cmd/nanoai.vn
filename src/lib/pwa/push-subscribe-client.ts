/**
 * Đăng ký Web Push trên client (Chrome Android, PWA…).
 * Cần NEXT_PUBLIC_VAPID_PUBLIC_KEY và HTTPS + service worker (bản production).
 */

export function getPushVapidPublicKey(): string | undefined {
  const k = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  return k || undefined
}

export function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/** PWA đã “Thêm vào màn hình chính”. */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  return document.referrer?.includes('android-app') ?? false
}

/** Chrome/Android (tab hoặc PWA) — Web Push thường hỗ trợ. */
export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

export function shouldOfferPushInstallUi(): boolean {
  return isStandalonePwa() || isAndroidDevice()
}

export async function syncPushSubscriptionWithServer(vapidPublic: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
      })
    }
    const json = sub.toJSON()
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(json),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn('[push] subscribe failed', res.status, errText)
      return false
    }
    return true
  } catch (e) {
    console.warn('[push] syncPushSubscriptionWithServer', e)
    return false
  }
}

export async function requestPushPermissionAndSubscribe(vapidPublic: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false
  return syncPushSubscriptionWithServer(vapidPublic)
}
