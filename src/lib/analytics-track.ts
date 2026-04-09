'use client'

type EventParams = Record<string, string | number | boolean | null | undefined>

type PendingGeneration = {
  route: string
  feature: string
  requiredCost: number
  startedAt: number
}

const PENDING_KEY = 'app.pending_generation'
const PENDING_KEY_LEGACY = 'nanoai.pending_generation'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function toFeatureFromRoute(route: string): string {
  const clean = (route || '/').split('?')[0]
  const first = clean.split('/').filter(Boolean)[0] || 'home'
  return first
}

export function trackEvent(eventName: string, params: EventParams = {}) {
  if (typeof window === 'undefined') return
  const gtag = window.gtag
  if (typeof gtag !== 'function') return
  gtag('event', eventName, params)
}

export function setPendingGeneration(pending: PendingGeneration) {
  if (typeof window === 'undefined') return
  try {
    const raw = JSON.stringify(pending)
    sessionStorage.setItem(PENDING_KEY, raw)
    sessionStorage.setItem(PENDING_KEY_LEGACY, raw)
  } catch {
    // ignore storage failures
  }
}

export function getPendingGeneration(): PendingGeneration | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingGeneration
  } catch {
    return null
  }
}

export function clearPendingGeneration() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(PENDING_KEY)
    sessionStorage.removeItem(PENDING_KEY_LEGACY)
  } catch {
    // ignore storage failures
  }
}
