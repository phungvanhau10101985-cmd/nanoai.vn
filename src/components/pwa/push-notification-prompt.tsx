'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getClientUserId } from '@/lib/auth/get-client-user-id'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import {
  getPushVapidPublicKey,
  requestPushPermissionAndSubscribe,
  shouldOfferPushInstallUi,
  syncPushSubscriptionWithServer,
} from '@/lib/pwa/push-subscribe-client'

const PUSH_PROMPT_DISMISS_KEY = 'app_push_prompt_dismiss'
const PUSH_PROMPT_DISMISS_KEY_LEGACY = 'nanoai_push_prompt_dismiss'

function isPushPromptDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.localStorage.getItem(PUSH_PROMPT_DISMISS_KEY) === '1'
    || window.localStorage.getItem(PUSH_PROMPT_DISMISS_KEY_LEGACY) === '1'
  )
}

function setPushPromptDismissed(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PUSH_PROMPT_DISMISS_KEY, '1')
  window.localStorage.setItem(PUSH_PROMPT_DISMISS_KEY_LEGACY, '1')
}

function clearPushPromptDismissed(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PUSH_PROMPT_DISMISS_KEY)
  window.localStorage.removeItem(PUSH_PROMPT_DISMISS_KEY_LEGACY)
}

/**
 * Gợi ý bật Web Push (Android / PWA). Cần NEXT_PUBLIC_VAPID_PUBLIC_KEY + migration push_subscriptions + bản build production (có SW).
 */
export function PushNotificationPrompt() {
  const vapidPublic = getPushVapidPublicKey()
  const mountedRef = useRef(true)
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [justEnabled, setJustEnabled] = useState(false)
  const [pushT, setPushT] = useState(() => getDictionary(readWebLocaleFromDocumentCookie()).push)

  useEffect(() => {
    const sync = () => setPushT(getDictionary(readWebLocaleFromDocumentCookie()).push)
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

  const runOfferCheck = useCallback(async (): Promise<void> => {
    if (!mountedRef.current || !vapidPublic || typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV === 'development') return
    if (!window.isSecureContext) return

    const uid = await getClientUserId()
    if (!uid || !mountedRef.current) return

    try {
      await navigator.serviceWorker.ready
      if (!mountedRef.current) return

      if (Notification.permission === 'granted') {
        void syncPushSubscriptionWithServer(vapidPublic)
        return
      }
      if (Notification.permission === 'denied') return
      if (isPushPromptDismissed()) return
      if (!shouldOfferPushInstallUi()) return

      if (mountedRef.current) setVisible(true)
    } catch {
      /* ignore */
    }
  }, [vapidPublic])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!vapidPublic) return
    let cancelled = false

    const delays = [0, 2500, 8000]
    const timers = delays.map((ms) =>
      window.setTimeout(() => {
        if (!cancelled) void runOfferCheck()
      }, ms)
    )

    return () => {
      cancelled = true
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [vapidPublic, runOfferCheck])

  const handleEnable = async () => {
    if (!vapidPublic) return
    setBusy(true)
    try {
      const synced = await requestPushPermissionAndSubscribe(vapidPublic)
      if (!synced) return
      setJustEnabled(true)
      clearPushPromptDismissed()
      window.setTimeout(() => {
        setVisible(false)
        setJustEnabled(false)
      }, 2200)
    } finally {
      setBusy(false)
    }
  }

  const handleLater = () => {
    setPushPromptDismissed()
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
