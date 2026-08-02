'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MESSAGING_GUEST_SESSION_HEADER,
  MESSAGING_GUEST_SESSION_STORAGE_KEY,
  MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY,
  MESSAGING_GUEST_SESSION_SYNC_COOKIE,
} from '@/lib/messaging/guest-auth-session'
import {
  MESSAGING_GUEST_ACCOUNT_HEADER,
  MESSAGING_GUEST_ACCOUNT_STORAGE_KEY,
  MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY,
} from '@/lib/messaging/guest-account-session'
import { partnerSiteSessionApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'

function readCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return ''
}

function readStoredSessionId(): string {
  if (typeof window === 'undefined') return ''
  const fromLs =
    window.localStorage.getItem(MESSAGING_GUEST_SESSION_STORAGE_KEY)?.trim()
    || window.localStorage.getItem(MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY)?.trim()
    || ''
  if (isValidMessagingGuestSessionId(fromLs)) return fromLs
  const fromCookie = readCookie(MESSAGING_GUEST_SESSION_SYNC_COOKIE).trim()
  if (isValidMessagingGuestSessionId(fromCookie)) return fromCookie
  return ''
}

function readStoredAccountId(): string {
  if (typeof window === 'undefined') return ''
  return (
    window.localStorage.getItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY)?.trim()
    || window.localStorage.getItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY)?.trim()
    || ''
  )
}

function persistSessionId(sessionId: string) {
  if (typeof window === 'undefined' || !isValidMessagingGuestSessionId(sessionId)) return
  window.localStorage.setItem(MESSAGING_GUEST_SESSION_STORAGE_KEY, sessionId)
  window.localStorage.setItem(MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY, sessionId)
}

function persistAccountId(accountId: string) {
  if (typeof window === 'undefined' || !accountId.trim()) return
  window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY, accountId.trim())
  window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY, accountId.trim())
}

export function usePartnerSiteGuestSession(siteSlug: string) {
  const [ready, setReady] = useState(false)
  const sessionRef = useRef('')
  const accountRef = useRef('')

  const captureFromResponse = useCallback((res: Response) => {
    const sid = res.headers.get(MESSAGING_GUEST_SESSION_HEADER)?.trim() ?? ''
    if (sid) {
      sessionRef.current = sid
      persistSessionId(sid)
    }
    const aid = res.headers.get(MESSAGING_GUEST_ACCOUNT_HEADER)?.trim() ?? ''
    if (aid) {
      accountRef.current = aid
      persistAccountId(aid)
    }
  }, [])

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {}
    const sid = sessionRef.current.trim()
    if (sid) h[MESSAGING_GUEST_SESSION_HEADER] = sid
    const aid = accountRef.current.trim()
    if (aid) h[MESSAGING_GUEST_ACCOUNT_HEADER] = aid
    return h
  }, [])

  useEffect(() => {
    let cancelled = false
    sessionRef.current = readStoredSessionId()
    accountRef.current = readStoredAccountId()
    void (async () => {
      try {
        const res = await fetch(partnerSiteSessionApiPath(siteSlug), {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            ...(sessionRef.current ? { [MESSAGING_GUEST_SESSION_HEADER]: sessionRef.current } : {}),
            ...(accountRef.current ? { [MESSAGING_GUEST_ACCOUNT_HEADER]: accountRef.current } : {}),
          },
        })
        captureFromResponse(res)
        const json = (await res.json().catch(() => ({}))) as { sessionId?: string }
        if (json.sessionId) {
          sessionRef.current = json.sessionId
          persistSessionId(json.sessionId)
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [captureFromResponse, siteSlug])

  return { ready, authHeaders, captureFromResponse }
}
