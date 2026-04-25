'use client'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    __nanoMetaEventKeys?: Set<string>
  }
}

const KEY_PREFIX = 'nano_meta_evt_'

function canUseDom(): boolean {
  return typeof window !== 'undefined'
}

function hasFbq(): boolean {
  return canUseDom() && typeof window.fbq === 'function'
}

function createEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

function readCookie(name: string): string {
  if (!canUseDom()) return ''
  const source = document.cookie || ''
  const parts = source.split(';')
  for (const part of parts) {
    const [k, ...rest] = part.split('=')
    if ((k || '').trim() !== name) continue
    return decodeURIComponent(rest.join('=').trim())
  }
  return ''
}

function sendMetaStandardEventToServer(params: {
  eventName: 'CompleteRegistration' | 'StartTrial' | 'Subscribe' | 'ViewContent'
  eventId: string
  customData?: Record<string, unknown>
}): void {
  if (!canUseDom()) return
  const body = {
    eventName: params.eventName,
    eventId: params.eventId,
    eventSourceUrl: window.location.href.slice(0, 2000),
    customData: params.customData,
    fbc: readCookie('_fbc'),
    fbp: readCookie('_fbp'),
  }
  void fetch('/api/tracking/meta-standard-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    // CAPI is best-effort; browser event has already been fired.
  })
}

function hasSentEvent(dedupeKey: string): boolean {
  if (!canUseDom()) return false
  const memory = window.__nanoMetaEventKeys ?? new Set<string>()
  window.__nanoMetaEventKeys = memory
  if (memory.has(dedupeKey)) return true
  try {
    const fromSession = window.sessionStorage.getItem(`${KEY_PREFIX}${dedupeKey}`)
    if (fromSession === '1') {
      memory.add(dedupeKey)
      return true
    }
  } catch {
    // Ignore storage errors (private mode, blocked storage).
  }
  return false
}

function markSentEvent(dedupeKey: string): void {
  if (!canUseDom()) return
  const memory = window.__nanoMetaEventKeys ?? new Set<string>()
  memory.add(dedupeKey)
  window.__nanoMetaEventKeys = memory
  try {
    window.sessionStorage.setItem(`${KEY_PREFIX}${dedupeKey}`, '1')
  } catch {
    // Ignore storage errors (private mode, blocked storage).
  }
}

/**
 * Fire a standard Meta event on browser (Pixel).
 * Uses an explicit dedupe key so we can prevent repeated fires in one session.
 */
export function fireMetaStandardEvent(
  eventName: 'CompleteRegistration' | 'StartTrial' | 'Subscribe' | 'ViewContent',
  options?: {
    dedupeKey?: string
    customData?: Record<string, unknown>
    skipDedupe?: boolean
  }
): boolean {
  if (!canUseDom()) return false
  const skipDedupe = options?.skipDedupe === true
  const key = (options?.dedupeKey || eventName).trim()
  if (!skipDedupe) {
    if (!key) return false
    if (hasSentEvent(key)) return false
  }
  const customData = options?.customData && Object.keys(options.customData).length > 0
    ? options.customData
    : undefined
  const eventId = createEventId()
  if (hasFbq()) {
    window.fbq!('track', eventName, customData ?? {}, { eventID: eventId })
  }
  sendMetaStandardEventToServer({
    eventName,
    eventId,
    ...(customData ? { customData } : {}),
  })
  if (!skipDedupe) {
    markSentEvent(key)
  }
  return true
}
