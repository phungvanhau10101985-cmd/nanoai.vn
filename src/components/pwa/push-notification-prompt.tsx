'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { DEFAULT_WEB_LOCALE, type WebLocale } from '@/lib/i18n/config'

const DISMISS_KEY = 'nanoai_push_prompt_dismiss'

function localeFromCookie(): WebLocale {
  if (typeof document === 'undefined') return DEFAULT_WEB_LOCALE
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
    .toLowerCase()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') {
    return cookieValue
  }
  return 'vi'
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  return document.referrer?.includes('android-app') ?? false
}

/**
 * Gợi ý bật Web Push khi đã cài PWA (Android). Cần NEXT_PUBLIC_VAPID_PUBLIC_KEY + bảng push_subscriptions.
 */
export function PushNotificationPrompt() {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [justEnabled, setJustEnabled] = useState(false)
  const [pushT, setPushT] = useState(() => getDictionary(localeFromCookie()).push)

  useEffect(() => {
    const sync = () => setPushT(getDictionary(localeFromCookie()).push)
    sync()
    const t = window.setInterval(sync, 1500)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  const syncSubscription = useCallback(async (): Promise<boolean> => {
    if (!vapidPublic || typeof window === 'undefined' || !('Notification' in window)) return false
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
      console.warn('[push] syncSubscription', e)
      return false
    }
  }, [vapidPublic])

  useEffect(() => {
    if (!vapidPublic) return

    let cancelled = false
    const run = async () => {
      if (typeof window === 'undefined') return
      if (!('Notification' in window) || !('serviceWorker' in navigator)) return
      if (process.env.NODE_ENV === 'development') return

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      try {
        await navigator.serviceWorker.ready

        if (Notification.permission === 'granted') {
          void syncSubscription()
          return
        }
        if (Notification.permission === 'denied') return
        if (localStorage.getItem(DISMISS_KEY) === '1') return
        if (!isStandalonePwa()) return

        if (!cancelled) setVisible(true)
      } catch {
        /* ignore */
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [vapidPublic, syncSubscription])

  const handleEnable = async () => {
    if (!vapidPublic) return
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return
      const synced = await syncSubscription()
      if (!synced) return
      setJustEnabled(true)
      localStorage.removeItem(DISMISS_KEY)
      window.setTimeout(() => {
        setVisible(false)
        setJustEnabled(false)
      }, 2200)
    } finally {
      setBusy(false)
    }
  }

  const handleLater = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  if (!vapidPublic || !visible) return null

  return (
    <div className="fixed bottom-36 left-4 right-4 z-[60] md:bottom-24 md:max-w-sm md:left-auto md:right-4 safe-area-pb">
      <div className="relative flex items-start gap-3 rounded-xl border bg-background p-4 shadow-lg">
        <button
          type="button"
          onClick={handleLater}
          className="absolute right-2 top-2 rounded-full p-1 hover:bg-muted"
          aria-label={pushT.later}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 pr-7">
          {justEnabled ? (
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{pushT.enabledToast}</p>
          ) : (
            <>
              <h3 className="mb-1 text-sm font-semibold">{pushT.bannerTitle}</h3>
              <p className="text-xs text-muted-foreground">{pushT.bannerHint}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={busy} onClick={() => void handleEnable()}>
                  {pushT.enable}
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={handleLater}>
                  {pushT.later}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
