'use client'

import { useEffect, useState } from 'react'

export type PartnerBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type WindowWithShopPwa = Window & {
  __nanoaiShopPwaPrompt?: PartnerBeforeInstallPromptEvent
  MSStream?: boolean
  standalone?: boolean
}

let deferred: PartnerBeforeInstallPromptEvent | null = null
let listening = false
const subscribers = new Set<() => void>()

function emit() {
  for (const sub of subscribers) sub()
}

function setDeferred(next: PartnerBeforeInstallPromptEvent | null) {
  deferred = next
  if (typeof window !== 'undefined') {
    const win = window as WindowWithShopPwa
    if (next) win.__nanoaiShopPwaPrompt = next
    else delete win.__nanoaiShopPwaPrompt
  }
  emit()
}

function readEarlyPrompt(): PartnerBeforeInstallPromptEvent | null {
  if (typeof window === 'undefined') return null
  return (window as WindowWithShopPwa).__nanoaiShopPwaPrompt ?? null
}

/** Call from shop shell so the event is not lost before the account tab mounts. */
export function ensurePartnerPwaInstallListener() {
  if (typeof window === 'undefined' || listening) return
  listening = true
  const early = readEarlyPrompt()
  if (early) deferred = early
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    setDeferred(event as PartnerBeforeInstallPromptEvent)
  })
  window.addEventListener('appinstalled', () => {
    setDeferred(null)
  })
}

export function isPartnerPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const win = window as WindowWithShopPwa
  return (
    win.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean(document.referrer?.includes('android-app'))
  )
}

export function isPartnerPwaIos(): boolean {
  if (typeof window === 'undefined') return false
  const win = window as WindowWithShopPwa
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !win.MSStream
}

export function usePartnerPwaInstall() {
  const [, setTick] = useState(0)

  useEffect(() => {
    ensurePartnerPwaInstallListener()
    const onChange = () => setTick((n) => n + 1)
    subscribers.add(onChange)
    const early = readEarlyPrompt()
    if (early && early !== deferred) setDeferred(early)
    return () => {
      subscribers.delete(onChange)
    }
  }, [])

  return {
    deferredInstall: deferred,
    isStandalone: isPartnerPwaStandalone(),
    isIos: isPartnerPwaIos(),
    promptInstall: async () => {
      if (!deferred) return
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === 'accepted') setDeferred(null)
    },
  }
}
