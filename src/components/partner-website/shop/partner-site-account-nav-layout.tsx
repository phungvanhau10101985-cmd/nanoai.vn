'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  ClipboardList,
  Clock,
  Download,
  Gift,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircle,
  Pencil,
  Shield,
  ShoppingBag,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { partnerSiteAccountNavActiveId } from '@/lib/partner-website/shop/partner-site-account-nav'
import { getPartnerSiteAccountMenuItems, type PartnerSiteAccountMenuItemId } from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { partnerSitePersonalizationApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

const NAV_ICONS: Record<PartnerSiteAccountMenuItemId, LucideIcon> = {
  account: UserRound,
  'edit-profile': Pencil,
  cart: ShoppingBag,
  orders: ClipboardList,
  wallet: Gift,
  'recently-viewed': Clock,
  addresses: MapPin,
  wishlist: Heart,
  contact: MessageCircle,
  security: Shield,
  notifications: Bell,
  'install-app': Download,
  logout: LogOut,
}

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
  const { isAuthenticated, authHeaders, captureFromResponse, clearSession } = usePartnerSiteGuestSession(siteSlug)
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

  const onLogout = useCallback(() => {
    void clearSession()
  }, [clearSession])

  const items = getPartnerSiteAccountMenuItems({ siteSlug, locale, customDomain }).filter((item) => {
    if (item.isLogout) return isAuthenticated
    return true
  })

  return (
    <div className="pw-shop-account-layout">
      <aside className="pw-shop-account-sidebar" data-pw-region={PW_REGION.accountNav}>
        <p className="pw-shop-account-nav-kicker">{t.navAccount}</p>
        <nav className="pw-shop-account-nav" aria-label={t.accountQuickLinks}>
          {items.map((item) => {
            const Icon = NAV_ICONS[item.id]
            const active = item.id === activeId
            if (item.isLogout) {
              return (
                <button
                  key={item.id}
                  type="button"
                  className="pw-shop-account-nav-item is-logout"
                  data-pw-el={PW_EL.menuItem}
                  onClick={onLogout}
                >
                  <span className="pw-shop-account-nav-ico">
                    <Icon className="pw-shop-account-nav-icon" aria-hidden="true" strokeWidth={2} />
                  </span>
                  <span>{item.label}</span>
                </button>
              )
            }
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`pw-shop-account-nav-item${active ? ' is-active' : ''}${item.isHeader ? ' is-header' : ''}`}
                data-pw-el={PW_EL.menuItem}
              >
                <span className="pw-shop-account-nav-ico">
                  <Icon className="pw-shop-account-nav-icon" aria-hidden="true" strokeWidth={2} />
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
              <span className="pw-shop-account-nav-ico">
                <LayoutDashboard className="pw-shop-account-nav-icon" aria-hidden="true" strokeWidth={2} />
              </span>
              <span>{t.accountOpenShopAdmin}</span>
            </a>
          ) : null}
        </nav>
      </aside>
      <div className="pw-shop-account-content" data-pw-region={PW_REGION.accountMain}>
        {children}
      </div>
    </div>
  )
}
