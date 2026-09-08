'use client'

import { useEffect, useState } from 'react'

export type PartnerBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type PartnerPwaPromptOutcome = 'accepted' | 'dismissed' | 'unavailable' | 'failed'

type WindowWithShopPwa = Window & {
  __nanoaiShopPwaPrompt?: PartnerBeforeInstallPromptEvent
  MSStream?: boolean
  standalone?: boolean
}

let deferred: PartnerBeforeInstallPromptEvent | null = null
let listening = false
let installedFromEvent = false
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

function markInstalledFromEvent() {
  installedFromEvent = true
  setDeferred(null)
}

function readEarlyPrompt(): PartnerBeforeInstallPromptEvent | null {
  if (typeof window === 'undefined') return null
  return (window as WindowWithShopPwa).__nanoaiShopPwaPrompt ?? null
}

/**
 * Chrome/Edge on Windows often reject `prompt()` after the user accepts,
 * while still installing. `userChoice` + `appinstalled` are the source of truth.
 */
export function shouldShowPartnerPwaInstallError(input: {
  promptRejected: boolean
  choice: 'accepted' | 'dismissed' | null
  appInstalled: boolean
  isStandalone: boolean
}): boolean {
  if (input.isStandalone || input.appInstalled || input.choice === 'accepted') return false
  if (input.choice === 'dismissed') return false
  return input.promptRejected
}

export async function settlePartnerPwaPrompt(
  event: PartnerBeforeInstallPromptEvent
): Promise<'accepted' | 'dismissed'> {
  const choicePromise = event.userChoice
  void Promise.resolve(event.prompt()).catch(() => undefined)
  const choice = await choicePromise
  return choice.outcome === 'accepted' ? 'accepted' : 'dismissed'
}

/** Call from shop shell so the event is not lost before the account tab mounts. */
export function ensurePartnerPwaInstallListener() {
  if (typeof window === 'undefined' || listening) return
  listening = true
  const early = readEarlyPrompt()
  if (early) deferred = early
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installedFromEvent = false
    setDeferred(event as PartnerBeforeInstallPromptEvent)
  })
  window.addEventListener('appinstalled', () => {
    markInstalledFromEvent()
  })
}

export function isPartnerPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (installedFromEvent) return true
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
    const standaloneMq =
      typeof window !== 'undefined' ? window.matchMedia('(display-mode: standalone)') : null
    const onStandalone = () => emit()
    standaloneMq?.addEventListener('change', onStandalone)
    return () => {
      subscribers.delete(onChange)
      standaloneMq?.removeEventListener('change', onStandalone)
    }
  }, [])

  return {
    deferredInstall: deferred,
    isStandalone: isPartnerPwaStandalone(),
    isIos: isPartnerPwaIos(),
    promptInstall: async (): Promise<PartnerPwaPromptOutcome> => {
      if (!deferred) return 'unavailable'
      const event = deferred
      try {
        const outcome = await settlePartnerPwaPrompt(event)
        setDeferred(null)
        return outcome
      } catch {
        setDeferred(null)
        if (installedFromEvent || isPartnerPwaStandalone()) return 'accepted'
        return 'failed'
      }
    },
  }
}
