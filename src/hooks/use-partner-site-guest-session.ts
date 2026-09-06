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

type GuestSessionBootstrap = { sessionId: string; accountId: string }

const guestSessionBootstrapBySlug = new Map<string, Promise<GuestSessionBootstrap>>()
const PARTNER_SITE_GUEST_SESSION_CHANGE_EVENT = 'pw-partner-site-guest-session-change'

function notifyGuestSessionChange(siteSlug: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(PARTNER_SITE_GUEST_SESSION_CHANGE_EVENT, {
      detail: { siteSlug: siteSlug.trim().toLowerCase() },
    })
  )
}

function clearGuestSessionBootstrap(siteSlug: string) {
  guestSessionBootstrapBySlug.delete(siteSlug.trim().toLowerCase())
}

async function loadGuestSessionBootstrap(siteSlug: string): Promise<GuestSessionBootstrap> {
  const skipAuthSync = shouldPartnerSiteShopSkipAuthSync(siteSlug)
  let sessionId = readStoredSessionId()
  let accountId = skipAuthSync ? '' : readStoredAccountId()

  const sessionRes = await fetch(partnerSiteSessionApiPath(siteSlug), {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      ...(sessionId ? { [MESSAGING_GUEST_SESSION_HEADER]: sessionId } : {}),
      ...(skipAuthSync ? { [PARTNER_SITE_SHOP_SKIP_AUTH_SYNC_HEADER]: '1' } : {}),
      ...(!skipAuthSync && accountId ? { [MESSAGING_GUEST_ACCOUNT_HEADER]: accountId } : {}),
    },
  })
  const sidHeader = sessionRes.headers.get(MESSAGING_GUEST_SESSION_HEADER)?.trim() ?? ''
  if (sidHeader) sessionId = sidHeader
  const sessionJson = (await sessionRes.json().catch(() => ({}))) as { sessionId?: string }
  if (sessionJson.sessionId) sessionId = sessionJson.sessionId
  if (sessionId) persistSessionId(sessionId)
  const aidFromSession = sessionRes.headers.get(MESSAGING_GUEST_ACCOUNT_HEADER)?.trim() ?? ''
  if (aidFromSession && !skipAuthSync) {
    accountId = aidFromSession
    persistAccountId(aidFromSession)
  }

  if (!skipAuthSync) {
    const syncRes = await fetch(partnerSiteAuthSyncApiPath(siteSlug), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        ...(sessionId ? { [MESSAGING_GUEST_SESSION_HEADER]: sessionId } : {}),
        ...(accountId ? { [MESSAGING_GUEST_ACCOUNT_HEADER]: accountId } : {}),
      },
    })
    const aidHeader = syncRes.headers.get(MESSAGING_GUEST_ACCOUNT_HEADER)?.trim() ?? ''
    const syncJson = (await syncRes.json().catch(() => ({}))) as { accountId?: string }
    const nextAid = (aidHeader || syncJson.accountId || '').trim()
    if (nextAid) {
      accountId = nextAid
      persistAccountId(nextAid)
    }
  }

  return { sessionId, accountId }
}

function sharedGuestSessionBootstrap(siteSlug: string): Promise<GuestSessionBootstrap> {
  const key = siteSlug.trim().toLowerCase()
  const existing = guestSessionBootstrapBySlug.get(key)
  if (existing) return existing
  const pending = loadGuestSessionBootstrap(siteSlug)
  guestSessionBootstrapBySlug.set(key, pending)
  return pending
}

export function usePartnerSiteGuestSession(siteSlug: string) {
  const [ready, setReady] = useState(false)
  const [authResolved, setAuthResolved] = useState(false)
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
      notifyGuestSessionChange(siteSlug)
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
    const normalizedSlug = siteSlug.trim().toLowerCase()
    const syncFromStorage = (resolveMissing = false) => {
      if (cancelled) return
      sessionRef.current = readStoredSessionId()
      const skip = shouldPartnerSiteShopSkipAuthSync(siteSlug)
      accountRef.current = skip ? '' : readStoredAccountId()
      if (skip) {
        setIsAuthenticated(false)
        setReady(true)
        setAuthResolved(true)
      } else if (accountRef.current) {
        setIsAuthenticated(true)
        setReady(true)
        setAuthResolved(true)
      } else if (sessionRef.current) {
        setIsAuthenticated(false)
        setReady(true)
      } else if (resolveMissing) {
        setIsAuthenticated(false)
        setReady(true)
        setAuthResolved(true)
      }
    }
    const onSessionChange = (event: Event) => {
      const detail = (event as CustomEvent<{ siteSlug?: string }>).detail
      if (detail?.siteSlug && detail.siteSlug !== normalizedSlug) return
      syncFromStorage(true)
    }
    const onStorage = (event: StorageEvent) => {
      if (
        event.key &&
        event.key !== MESSAGING_GUEST_SESSION_STORAGE_KEY &&
        event.key !== MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY &&
        event.key !== MESSAGING_GUEST_ACCOUNT_STORAGE_KEY &&
        event.key !== MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY
      ) {
        return
      }
      syncFromStorage(true)
    }
    const onPageShow = () => syncFromStorage()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncFromStorage()
    }
    window.addEventListener(PARTNER_SITE_GUEST_SESSION_CHANGE_EVENT, onSessionChange)
    window.addEventListener('storage', onStorage)
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibilityChange)

    syncFromStorage()
    const skipAuthSync = shouldPartnerSiteShopSkipAuthSync(siteSlug)
    if (skipAuthSync) {
      accountRef.current = ''
      setIsAuthenticated(false)
      setReady(true)
      setAuthResolved(true)
    } else if (accountRef.current) {
      setIsAuthenticated(true)
      setReady(true)
      setAuthResolved(true)
    } else if (sessionRef.current) {
      setIsAuthenticated(false)
      setReady(true)
    }
    void sharedGuestSessionBootstrap(siteSlug)
      .then((result) => {
        if (cancelled) return
        if (result.sessionId) {
          sessionRef.current = result.sessionId
          persistSessionId(result.sessionId)
        }
        if (skipAuthSync) {
          accountRef.current = ''
          setIsAuthenticated(false)
          return
        }
        if (result.accountId) {
          accountRef.current = result.accountId
          persistAccountId(result.accountId)
          setIsAuthenticated(true)
          clearPartnerSiteShopSkipAuthSync(siteSlug)
        }
      })
      .finally(() => {
        if (cancelled) return
        setReady(true)
        setAuthResolved(true)
      })

    return () => {
      cancelled = true
      window.removeEventListener(PARTNER_SITE_GUEST_SESSION_CHANGE_EVENT, onSessionChange)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [siteSlug])

  const clearSession = useCallback(async (opts?: { nextHref?: string }) => {
    sessionRef.current = ''
    accountRef.current = ''
    setIsAuthenticated(false)
    setReady(true)
    setAuthResolved(true)
    clearGuestSessionBootstrap(siteSlug)
    markPartnerSiteShopSkipAuthSync(siteSlug)
    notifyGuestSessionChange(siteSlug)
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
    if (opts?.nextHref) {
      window.location.assign(opts.nextHref)
      return
    }
    window.location.reload()
  }, [siteSlug])

  return { ready, authResolved, isAuthenticated, authHeaders, captureFromResponse, clearSession }
}
