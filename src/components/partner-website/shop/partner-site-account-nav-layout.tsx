'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import {
  normalizePartnerSitePathname,
  partnerSiteAccountNavActiveId,
} from '@/lib/partner-website/shop/partner-site-account-nav'
import {
  getPartnerSiteAccountMenuItems,
  isPartnerSiteAccountSidebarItem,
  partnerSiteAccountMenuEmoji,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { partnerSiteAccountPath, partnerSitePersonalizationApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  siteSlug: string
  locale: WebLocale
  unreadNotifications?: number
  children: React.ReactNode
}

export function PartnerSiteAccountNavLayout({
  siteSlug,
  locale,
  unreadNotifications = 0,
  children,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const pathname = usePathname()
  const customDomain = usePartnerSiteCustomDomain()
  const { isAuthenticated, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [shopAdminHref, setShopAdminHref] = useState<string | null>(null)
  const activeId = partnerSiteAccountNavActiveId(pathname || '')

  useEffect(() => {
    if (!isAuthenticated) {
      setShopAdminHref(null)
      return
    }
    let cancelled = false
    void fetch(partnerSitePersonalizationApiPath(siteSlug, 'profile'), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
      .then(async (res) => {
        captureFromResponse(res)
        const json = (await res.json().catch(() => ({}))) as { shopAdmin?: { href?: string } | null }
        if (!cancelled) setShopAdminHref(json.shopAdmin?.href?.trim() || null)
      })
      .catch(() => {
        if (!cancelled) setShopAdminHref(null)
      })
    return () => {
      cancelled = true
    }
  }, [authHeaders, captureFromResponse, isAuthenticated, siteSlug])

  const items = getPartnerSiteAccountMenuItems({ siteSlug, locale, customDomain }).filter(
    isPartnerSiteAccountSidebarItem
  )
  const path = normalizePartnerSitePathname(pathname || '')
  const showMobileBack = path !== '/account' && path !== '/login' && !path.startsWith('/login/')

  return (
    <div className="pw-shop-account-layout">
      <aside className="pw-shop-account-sidebar" data-pw-region={PW_REGION.accountNav}>
        <nav className="pw-shop-account-nav" aria-label={t.accountQuickLinks}>
          {items.map((item) => {
            const active = item.id === activeId
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`pw-shop-account-nav-item${active ? ' is-active' : ''}${item.isHeader ? ' is-header' : ''}`}
                data-pw-el={PW_EL.menuItem}
              >
                <span className="pw-shop-account-nav-emoji" aria-hidden="true">
                  {item.emoji}
                </span>
                <span>{item.label}</span>
                {item.id === 'notifications' && unreadNotifications > 0 ? (
                  <span className="pw-shop-account-nav-badge">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                ) : null}
              </Link>
            )
          })}
          {shopAdminHref ? (
            <a
              href={shopAdminHref}
              className="pw-shop-account-nav-item is-accent"
              data-pw-el={PW_EL.menuItem}
              rel="noopener noreferrer"
            >
              <span className="pw-shop-account-nav-emoji" aria-hidden="true">
                {partnerSiteAccountMenuEmoji('admin')}
              </span>
              <span>{t.accountOpenShopAdmin}</span>
            </a>
          ) : null}
        </nav>
      </aside>
      <div className="pw-shop-account-content" data-pw-region={PW_REGION.accountMain}>
        {shopAdminHref ? (
          <a href={shopAdminHref} className="pw-shop-account-admin-banner" rel="noopener noreferrer">
            {partnerSiteAccountMenuEmoji('admin')} {t.accountOpenShopAdmin}
          </a>
        ) : null}
        {showMobileBack ? (
          <Link href={partnerSiteAccountPath(siteSlug, { customDomain })} className="pw-shop-account-back">
            {t.accountBackToAccount}
          </Link>
        ) : null}
        {children}
      </div>
    </div>
  )
}
