'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { partnerSitePersonalizationApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  shopCustomerInitials,
  shopCustomerLoginLabel,
} from '@/lib/partner-website/shop/partner-site-login-identity'
import {
  loginIdentityFromAccountCache,
  PW_ACCOUNT_BROWSER_CACHE_CHANGE_EVENT,
  readPartnerSiteAccountBrowserCache,
  writePartnerSiteAccountBrowserCache,
} from '@/lib/partner-website/shop/partner-site-account-browser-cache'

export function PartnerSiteLoginChromeLink(input: {
  siteSlug: string
  loginHref: string
  accountHref: string
  loginLabel: string
}) {
  const { isAuthenticated, authHeaders } = usePartnerSiteGuestSession(input.siteSlug)
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useLayoutEffect(() => {
    const apply = () => {
      const identity = loginIdentityFromAccountCache(readPartnerSiteAccountBrowserCache(input.siteSlug))
      if (!identity) return
      setName(identity.name)
      setAvatarUrl(identity.avatarUrl)
    }
    apply()
    const onCache = (event: Event) => {
      const slug = (event as CustomEvent<{ siteSlug?: string }>).detail?.siteSlug
      if (slug && slug !== input.siteSlug.trim().toLowerCase()) return
      apply()
    }
    window.addEventListener(PW_ACCOUNT_BROWSER_CACHE_CHANGE_EVENT, onCache)
    return () => window.removeEventListener(PW_ACCOUNT_BROWSER_CACHE_CHANGE_EVENT, onCache)
  }, [input.siteSlug])

  useEffect(() => {
    if (!isAuthenticated) {
      if (!loginIdentityFromAccountCache(readPartnerSiteAccountBrowserCache(input.siteSlug))) {
        setName('')
        setAvatarUrl(null)
      }
      return
    }
    let cancelled = false
    const headers = authHeaders()
    void fetch(partnerSitePersonalizationApiPath(input.siteSlug, 'profile'), {
      credentials: 'same-origin',
      headers,
    })
      .then((res) => res.json().catch(() => ({})))
      .then((json: { profile?: { customer_name?: string | null; greeting_name?: string | null; email?: string | null; avatar_url?: string | null } }) => {
        if (cancelled) return
        const profile = json.profile
        setName(
          shopCustomerLoginLabel({
            customerName: profile?.customer_name,
            profileName: profile?.greeting_name,
            email: profile?.email,
          })
        )
        const avatar = String(profile?.avatar_url ?? '').trim()
        setAvatarUrl(/^https?:\/\//i.test(avatar) ? avatar : null)
        if (profile) {
          writePartnerSiteAccountBrowserCache(input.siteSlug, { profile })
        }
      })
      .catch(() => {
        if (!cancelled) setName((prev) => prev)
      })
    return () => {
      cancelled = true
    }
  }, [authHeaders, input.siteSlug, isAuthenticated])

  const href = isAuthenticated ? input.accountHref : input.loginHref
  const label = isAuthenticated ? name : input.loginLabel
  const showIdentity = isAuthenticated

  return (
    <a
      href={href}
      data-pw-el={PW_EL.link}
      data-pw-chrome-btn="login"
      data-pw-chrome-style="text"
      {...(showIdentity
        ? {
            'data-pw-login-identity': '1',
            'data-pw-login-chrome': '1',
            'aria-label': label || undefined,
            title: label || undefined,
          }
        : {})}
    >
      {showIdentity ? (
        avatarUrl ? (
          <img className="pw-login-avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" decoding="async" />
        ) : (
          <span className="pw-login-avatar-fallback" aria-hidden="true">
            {shopCustomerInitials(label)}
          </span>
        )
      ) : null}
      <span className="pw-chrome-btn-label">{label || input.loginLabel}</span>
    </a>
  )
}
