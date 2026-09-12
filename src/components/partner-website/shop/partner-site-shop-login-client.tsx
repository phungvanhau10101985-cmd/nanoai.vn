'use client'

import { useCallback, useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { PartnerSiteShopAuthPanel } from '@/components/partner-website/shop/partner-site-shop-auth-panel'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { PARTNER_SITE_CUSTOMER_TOKEN_QUERY_KEY } from '@/lib/messaging/partner-site-customer-auth-constants'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { PARTNER_SITE_GOOGLE_AUTH_HANDOFF_QUERY_KEY } from '@/lib/partner-website/shop/partner-site-google-auth-handoff-client'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { getPartnerShopLoginRedirectFromUrl } from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import { partnerSiteAccountPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  siteSlug: string
  partnerSlug: string
  shopTitle?: string
  locale: WebLocale
  googleAuthEnabled?: boolean
  platformAuthOrigin?: string
}

function hasPendingAuthHandoff(): boolean {
  if (typeof window === 'undefined') return false
  const sp = new URLSearchParams(window.location.search)
  return Boolean(
    sp.get(PARTNER_SITE_GOOGLE_AUTH_HANDOFF_QUERY_KEY)?.trim() ||
      sp.get(PARTNER_SITE_CUSTOMER_TOKEN_QUERY_KEY)?.trim()
  )
}

export function PartnerSiteShopLoginClient({
  siteSlug,
  partnerSlug,
  shopTitle,
  locale,
  googleAuthEnabled,
  platformAuthOrigin,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { authResolved, isAuthenticated } = usePartnerSiteGuestSession(siteSlug)
  const [dest, setDest] = useState(() =>
    typeof window === 'undefined'
      ? partnerSiteAccountPath(siteSlug)
      : getPartnerShopLoginRedirectFromUrl(siteSlug, { customDomain })
  )

  useEffect(() => {
    setDest(getPartnerShopLoginRedirectFromUrl(siteSlug, { customDomain }))
  }, [customDomain, siteSlug])

  const goDest = useCallback(() => {
    if (typeof window === 'undefined') return
    window.location.replace(dest)
  }, [dest])

  useEffect(() => {
    if (!authResolved || !isAuthenticated) return
    if (hasPendingAuthHandoff()) return
    goDest()
  }, [authResolved, goDest, isAuthenticated])

  return (
    <div data-pw-region={PW_REGION.accountMain} className="pw-shop-login">
      <h1 data-pw-el={PW_EL.heading}>{t.authLoginTitle}</h1>
      {shopTitle ? <p className="pw-shop-auth-panel-welcome">{t.authLoginWelcome} {shopTitle}</p> : null}
      <p className="pw-shop-muted" data-pw-el={PW_EL.body}>
        {t.authLoginSubtitle}
      </p>
      <PartnerSiteShopAuthPanel
        partnerSlug={partnerSlug}
        siteSlug={siteSlug}
        shopTitle={shopTitle}
        locale={locale}
        pageMode
        googleAuthEnabled={googleAuthEnabled}
        platformAuthOrigin={platformAuthOrigin}
        onAuthed={goDest}
      />
    </div>
  )
}
