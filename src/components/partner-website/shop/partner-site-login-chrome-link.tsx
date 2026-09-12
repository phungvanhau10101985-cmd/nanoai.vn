'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { partnerSitePersonalizationApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  shopCustomerInitials,
  shopCustomerLoginLabel,
} from '@/lib/partner-website/shop/partner-site-login-identity'

export function PartnerSiteLoginChromeLink(input: {
  siteSlug: string
  loginHref: string
  accountHref: string
  loginLabel: string
}) {
  const { isAuthenticated, authHeaders } = usePartnerSiteGuestSession(input.siteSlug)
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setName('')
      setAvatarUrl(null)
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
      })
      .catch(() => {
        if (!cancelled) setName('')
      })
    return () => {
      cancelled = true
    }
  }, [authHeaders, input.siteSlug, isAuthenticated])

  if (!isAuthenticated) {
    return (
      <Link href={input.loginHref} data-pw-el={PW_EL.link} data-pw-chrome-btn="login" data-pw-chrome-style="text">
        {input.loginLabel}
      </Link>
    )
  }

  const label = name || input.loginLabel
  return (
    <Link
      href={input.accountHref}
      data-pw-el={PW_EL.link}
      data-pw-chrome-btn="login"
      data-pw-chrome-style="text"
      data-pw-login-identity="1"
      data-pw-login-chrome="1"
      aria-label={label}
      title={label}
    >
      {avatarUrl ? (
        <img className="pw-login-avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" decoding="async" />
      ) : (
        <span className="pw-login-avatar-fallback" aria-hidden="true">
          {shopCustomerInitials(label)}
        </span>
      )}
      <span className="pw-chrome-btn-label">{label}</span>
    </Link>
  )
}
