'use client'

import { useLayoutEffect } from 'react'
import {
  consumePartnerSiteGoogleAuthHandoffFromWindow,
  PARTNER_SITE_GOOGLE_AUTH_HANDOFF_QUERY_KEY,
} from '@/lib/partner-website/shop/partner-site-google-auth-handoff-client'
import { clearPartnerSiteShopSkipAuthSync } from '@/lib/partner-website/shop/partner-site-shop-auth-skip-sync'
import { markPartnerSiteFreshLoginSession } from '@/lib/partner-website/shop/partner-site-birth-gender-prompt-session'

/** Consume custom-domain Google handoff on every shop route, before passive effects redirect guests. */
export function PartnerSiteGoogleAuthHandoffBoot({ siteSlug }: { siteSlug: string }) {
  useLayoutEffect(() => {
    const token = new URLSearchParams(window.location.search)
      .get(PARTNER_SITE_GOOGLE_AUTH_HANDOFF_QUERY_KEY)
      ?.trim()
    if (!token) return
    clearPartnerSiteShopSkipAuthSync(siteSlug)
    void consumePartnerSiteGoogleAuthHandoffFromWindow({ siteSlug }).then((ok) => {
      if (!ok) return
      markPartnerSiteFreshLoginSession(siteSlug)
      // Reload once with the new shop-domain cookies so every server/client surface
      // (account, orders, cart, saved products) starts from the same identity.
      window.location.replace(window.location.href)
    })
  }, [siteSlug])

  return null
}
