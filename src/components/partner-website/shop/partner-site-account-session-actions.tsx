'use client'

import { useCallback } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { buildPartnerShopLoginHref } from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteAccountPath, partnerSiteHomePath } from '@/lib/partner-website/shop/partner-site-shop-paths'

type Props = {
  siteSlug: string
  locale: WebLocale
}

/** 188 `AccountSessionActions` — chỉ hub + hồ sơ, không nằm sidebar. */
export function PartnerSiteAccountSessionActions({ siteSlug, locale }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { clearSession } = usePartnerSiteGuestSession(siteSlug)

  const onSwitch = useCallback(() => {
    const login = buildPartnerShopLoginHref(siteSlug, partnerSiteAccountPath(siteSlug, { customDomain }), {
      customDomain,
    })
    const sep = login.includes('?') ? '&' : '?'
    void clearSession({ nextHref: `${login}${sep}switch=1` })
  }, [clearSession, customDomain, siteSlug])

  const onLogout = useCallback(() => {
    void clearSession({ nextHref: partnerSiteHomePath(siteSlug, { customDomain }) })
  }, [clearSession, customDomain, siteSlug])

  return (
    <div className="pw-shop-account-session-box">
      <p className="pw-shop-account-session-kicker">{t.accountSessionTitle}</p>
      <div className="pw-shop-account-session-btns">
        <button type="button" className="pw-shop-account-session-switch" onClick={onSwitch}>
          {t.accountSwitchAccount}
        </button>
        <button type="button" className="pw-shop-account-session-logout" onClick={onLogout}>
          {t.navLogout}
        </button>
      </div>
    </div>
  )
}
