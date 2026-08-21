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
  MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE,
} from '@/lib/messaging/guest-account-session'
import { partnerSiteAuthSyncApiPath, partnerSiteSessionApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  clearPartnerSiteShopSkipAuthSync,
  markPartnerSiteShopSkipAuthSync,
  PARTNER_SITE_SHOP_SKIP_AUTH_SYNC_HEADER,
  shouldPartnerSiteShopSkipAuthSync,
} from '@/lib/partner-website/shop/partner-site-shop-auth-skip-sync'
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
    window.localStorage.getItem(MESSAGING_GUEST_SESSION_STORAGE_KEY)?.trim() ||
    window.localStorage.getItem(MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY)?.trim() ||
    ''
  if (isValidMessagingGuestSessionId(fromLs)) return fromLs
  const fromCookie = readCookie(MESSAGING_GUEST_SESSION_SYNC_COOKIE).trim()
  if (isValidMessagingGuestSessionId(fromCookie)) return fromCookie
  return ''
}

function readStoredAccountId(): string {
  if (typeof window === 'undefined') return ''
  return (
    window.localStorage.getItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY)?.trim() ||
    window.localStorage.getItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY)?.trim() ||
    ''
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
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const sessionRef = useRef('')
  const accountRef = useRef('')

  const captureFromResponse = useCallback(
    (res: Response) => {
      const sid = res.headers.get(MESSAGING_GUEST_SESSION_HEADER)?.trim() ?? ''
      if (sid) {
        sessionRef.current = sid
        persistSessionId(sid)
      }
      const aid = res.headers.get(MESSAGING_GUEST_ACCOUNT_HEADER)?.trim() ?? ''
      if (!aid) return
      // After explicit shop logout, ignore any account header so platform session cannot re-bind.
      if (shouldPartnerSiteShopSkipAuthSync(siteSlug)) return
      accountRef.current = aid
      setIsAuthenticated(true)
      persistAccountId(aid)
      clearPartnerSiteShopSkipAuthSync(siteSlug)
    },
    [siteSlug]
  )

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {}
    const sid = sessionRef.current.trim()
    if (sid) h[MESSAGING_GUEST_SESSION_HEADER] = sid
    const skip = shouldPartnerSiteShopSkipAuthSync(siteSlug)
    if (skip) {
      h[PARTNER_SITE_SHOP_SKIP_AUTH_SYNC_HEADER] = '1'
      return h
    }
    const aid = accountRef.current.trim()
    if (aid) h[MESSAGING_GUEST_ACCOUNT_HEADER] = aid
    return h
  }, [siteSlug])

  useEffect(() => {
    let cancelled = false
    sessionRef.current = readStoredSessionId()
    accountRef.current = readStoredAccountId()
    const skipAuthSync = shouldPartnerSiteShopSkipAuthSync(siteSlug)
    if (skipAuthSync) {
      accountRef.current = ''
      setIsAuthenticated(false)
      setReady(true)
    } else if (accountRef.current) {
      setIsAuthenticated(true)
      setReady(true)
    }
    void (async () => {
      try {
        const res = await fetch(partnerSiteSessionApiPath(siteSlug), {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            ...(sessionRef.current ? { [MESSAGING_GUEST_SESSION_HEADER]: sessionRef.current } : {}),
            ...(skipAuthSync ? { [PARTNER_SITE_SHOP_SKIP_AUTH_SYNC_HEADER]: '1' } : {}),
            ...(!skipAuthSync && accountRef.current
              ? { [MESSAGING_GUEST_ACCOUNT_HEADER]: accountRef.current }
              : {}),
          },
        })
        captureFromResponse(res)
        const json = (await res.json().catch(() => ({}))) as { sessionId?: string }
        if (json.sessionId) {
          sessionRef.current = json.sessionId
          persistSessionId(json.sessionId)
        }
        if (!cancelled && !accountRef.current) setReady(true)
        if (!skipAuthSync) {
          const syncRes = await fetch(partnerSiteAuthSyncApiPath(siteSlug), {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              ...(sessionRef.current ? { [MESSAGING_GUEST_SESSION_HEADER]: sessionRef.current } : {}),
              ...(accountRef.current ? { [MESSAGING_GUEST_ACCOUNT_HEADER]: accountRef.current } : {}),
            },
          })
          captureFromResponse(syncRes)
          const syncJson = (await syncRes.json().catch(() => ({}))) as { accountId?: string }
          if (syncJson.accountId) {
            accountRef.current = syncJson.accountId
            setIsAuthenticated(true)
            persistAccountId(syncJson.accountId)
          }
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [captureFromResponse, siteSlug])

  const clearSession = useCallback(async () => {
    sessionRef.current = ''
    accountRef.current = ''
    setIsAuthenticated(false)
    markPartnerSiteShopSkipAuthSync(siteSlug)
    try {
      window.localStorage.removeItem(MESSAGING_GUEST_SESSION_STORAGE_KEY)
      window.localStorage.removeItem(MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY)
      window.localStorage.removeItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY)
      window.localStorage.removeItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY)
    } catch {
      /* ignore */
    }
    try {
      const expire = 'Max-Age=0; path=/'
      document.cookie = `${MESSAGING_GUEST_SESSION_SYNC_COOKIE}=; ${expire}`
      document.cookie = `${MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE}=; ${expire}`
    } catch {
      /* ignore */
    }
    try {
      await fetch(partnerSiteSessionApiPath(siteSlug), {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { [PARTNER_SITE_SHOP_SKIP_AUTH_SYNC_HEADER]: '1' },
      })
    } catch {
      /* ignore */
    }
    window.location.reload()
  }, [siteSlug])

  return { ready, isAuthenticated, authHeaders, captureFromResponse, clearSession }
}
