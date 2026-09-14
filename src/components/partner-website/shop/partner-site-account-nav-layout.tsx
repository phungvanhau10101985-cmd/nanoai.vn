'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
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
import {
  readPartnerSiteAccountBrowserCache,
  writePartnerSiteAccountBrowserCache,
} from '@/lib/partner-website/shop/partner-site-account-browser-cache'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { PW_SHOP_SOFT_NAV_EVENT } from '@/components/partner-website/shop/partner-site-soft-nav-relay'

type Props = {
  siteSlug: string
  locale: WebLocale
  pathname?: string
  unreadNotifications?: number
  children: React.ReactNode
}

export function PartnerSiteAccountNavLayout({
  siteSlug,
  locale,
  pathname: pathnameProp = '',
  unreadNotifications = 0,
  children,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { isAuthenticated, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [shopAdminHref, setShopAdminHref] = useState<string | null>(null)
  const [pathname, setPathname] = useState(pathnameProp)
  const activeId = partnerSiteAccountNavActiveId(pathname || pathnameProp)

  useLayoutEffect(() => {
    if (pathnameProp) {
      setPathname(pathnameProp)
      return
    }
    setPathname(window.location.pathname)
  }, [pathnameProp])

  useLayoutEffect(() => {
    const onNav = (event: Event) => {
      const href = (event as CustomEvent<{ href?: string }>).detail?.href
      if (!href) return
      try {
        setPathname(new URL(href, window.location.href).pathname)
      } catch {
        /* ignore */
      }
    }
    window.addEventListener(PW_SHOP_SOFT_NAV_EVENT, onNav)
    return () => window.removeEventListener(PW_SHOP_SOFT_NAV_EVENT, onNav)
  }, [])

  useLayoutEffect(() => {
    const cached = readPartnerSiteAccountBrowserCache(siteSlug)
    if (cached?.shopAdminHref) setShopAdminHref(cached.shopAdminHref)
  }, [siteSlug])

  useEffect(() => {
    if (!isAuthenticated) {
      if (!readPartnerSiteAccountBrowserCache(siteSlug)?.shopAdminHref) setShopAdminHref(null)
      return
    }
    let cancelled = false
    void fetch(partnerSitePersonalizationApiPath(siteSlug, 'profile'), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
      .then(async (res) => {
        captureFromResponse(res)
        const json = (await res.json().catch(() => ({}))) as {
          profile?: unknown
          shopAdmin?: { href?: string } | null
        }
        if (cancelled) return
        const href = json.shopAdmin?.href?.trim() || null
        setShopAdminHref(href)
        writePartnerSiteAccountBrowserCache(siteSlug, {
          profile: json.profile,
          shopAdminHref: href,
        })
      })
      .catch(() => {
        if (!cancelled) setShopAdminHref((prev) => prev)
      })
    return () => {
      cancelled = true
    }
  }, [authHeaders, captureFromResponse, isAuthenticated, siteSlug])

  const items = getPartnerSiteAccountMenuItems({ siteSlug, locale, customDomain }).filter(
    isPartnerSiteAccountSidebarItem
  )
  const path = normalizePartnerSitePathname(pathname || pathnameProp || '')
  const showMobileBack = path !== '/account' && path !== '/login' && !path.startsWith('/login/')

  return (
    <div className="pw-shop-account-layout">
      <aside className="pw-shop-account-sidebar" data-pw-region={PW_REGION.accountNav}>
        <nav className="pw-shop-account-nav" aria-label={t.accountQuickLinks}>
          {items.map((item) => {
            const active = item.id === activeId
            return (
              <a
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
              </a>
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
          <a href={partnerSiteAccountPath(siteSlug, { customDomain })} className="pw-shop-account-back">
            {t.accountBackToAccount}
          </a>
        ) : null}
        {children}
      </div>
    </div>
  )
}
