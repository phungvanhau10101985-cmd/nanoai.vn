'use client'

import {
  deleteGuestCreations,
  guestCreationRecordId,
  listGuestCreations,
  saveGuestCreation,
  type GuestCreationRecord,
} from '@/lib/guest-creations/browser-store'
import { extractGuestCreation, guestCreationHasPayload } from '@/lib/guest-creations/extract-guest-creation'
import { toFeatureFromRoute } from '@/lib/analytics-track'

type Mode = 'unknown' | 'guest' | 'user'

const MAX_BODY = 3_000_000
const buffer: GuestCreationRecord[] = []
let mode: Mode = 'unknown'
let claiming: Promise<void> | null = null

export function installGuestCreationSync(onClaimed: () => void): () => void {
  const win = window as Window & { __nanoGuestFetchOrig?: typeof window.fetch }
  const orig = win.__nanoGuestFetchOrig || window.fetch.bind(window)
  if (!win.__nanoGuestFetchOrig) {
    win.__nanoGuestFetchOrig = orig
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await orig(input, init)
      if (res.ok && mode !== 'user') {
        const url = requestUrl(input)
        if (isSameOrigin(url) && shouldInspect(requestMethod(input, init), url)) {
          let clone: Response | null = null
          try {
            clone = res.clone()
          } catch {
            clone = null
          }
          if (clone) void inspectResponse(clone)
        }
      }
      return res
    }
  }
  const refresh = () => {
    void refreshMode(orig, onClaimed)
  }
  window.addEventListener('credits-updated', refresh)
  window.addEventListener('focus', refresh)
  refresh()
  return () => {
    window.removeEventListener('credits-updated', refresh)
    window.removeEventListener('focus', refresh)
  }
}

async function refreshMode(orig: typeof window.fetch, onClaimed: () => void): Promise<void> {
  try {
    const res = await orig('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
    if (!res.ok) {
      mode = 'guest'
      const pending = buffer.splice(0)
      for (const row of pending) await saveGuestCreation(row).catch(() => undefined)
      if (pending.length) window.dispatchEvent(new Event('guest-creations-updated'))
      return
    }
    mode = 'user'
    buffer.length = 0
    await claimStored(orig, onClaimed)
  } catch {
    // Giữ mode cũ. Lần focus sau sẽ thử lại.
  }
}

async function claimStored(orig: typeof window.fetch, onClaimed: () => void): Promise<void> {
  if (claiming) return claiming
  claiming = (async () => {
    const items = await listGuestCreations().catch(() => [])
    if (!items.length) return
    const res = await orig('/api/account/claim-guest-creations', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((item) => ({
          resultUrls: item.resultUrls,
          refs: item.refs,
          feature: item.feature,
          route: item.route,
          createdAt: item.createdAt,
        })),
      }),
    })
    if (!res.ok) return
    await deleteGuestCreations(items.map((item) => item.id))
    onClaimed()
    window.dispatchEvent(new Event('guest-creations-updated'))
  })().finally(() => {
    claiming = null
  })
  return claiming
}

async function inspectResponse(res: Response): Promise<void> {
  if (mode === 'user') return
  const length = Number(res.headers.get('content-length') || 0)
  if (length > MAX_BODY) return
  let text = ''
  try {
    text = await res.text()
  } catch {
    return
  }
  if (text.length > MAX_BODY) text = `${text.slice(0, 400_000)}${text.slice(-400_000)}`
  const route = window.location.pathname || '/'
  const extracted = extractGuestCreation(text, { route })
  if (!guestCreationHasPayload(extracted)) return
  const record: GuestCreationRecord = {
    id: guestCreationRecordId({ resultUrls: extracted.resultUrls, refs: extracted.refs, route }),
    createdAt: Date.now(),
    route,
    feature: toFeatureFromRoute(route),
    resultUrls: extracted.resultUrls,
    refs: extracted.refs,
  }
  if (mode === 'guest') {
    await saveGuestCreation(record).catch(() => undefined)
    window.dispatchEvent(new Event('guest-creations-updated'))
    return
  }
  if (buffer.length < 20) buffer.push(record)
}

function shouldInspect(method: string, url: string): boolean {
  let path = url
  try {
    path = new URL(url, window.location.origin).pathname
  } catch {
    return false
  }
  if (path.startsWith('/api/auth') || path.startsWith('/api/account/')) return false
  if (method === 'POST') return true
  if (method !== 'GET') return false
  return /\/(generate|hub-chat|status|result|history|jobs)\b/.test(path)
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url
  return ''
}

function isSameOrigin(url: string): boolean {
  try {
    return new URL(url, window.location.origin).origin === window.location.origin
  } catch {
    return false
  }
}
