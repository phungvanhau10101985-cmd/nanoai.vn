'use client'

import Link from 'next/link'
import {
  ClipboardList,
  Clock,
  Home,
  MapPin,
  Menu,
  Package,
  Pencil,
  ShoppingBag,
  Tag,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { PartnerSiteChatWidgetProvider } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import { PartnerSiteShopSearchBar } from '@/components/partner-website/shop/partner-site-shop-search-bar'
import { PartnerSiteShopTrackingBootstrap } from '@/components/partner-website/shop/partner-site-shop-tracking-bootstrap'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteCartApiPath, partnerSiteInfoPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  getPartnerSiteAccountMenuItems,
  getPartnerSiteCategoryNavLabels,
  getPartnerSiteShopNavPaths,
  type PartnerSiteAccountMenuItemId,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { buildPartnerSiteShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import {
  PartnerSiteShopProvider,
  usePartnerSiteShop,
} from '@/lib/partner-website/shop/partner-site-shop-context'

type Props = {
  siteSlug: string
  partnerSlug: string
  title: string
  logoUrl: string | null
  theme: PartnerWebsiteTheme
  locale: WebLocale
  chatPath: string
  tracking: PartnerSiteShopTrackingConfig
  activeNav?: 'home' | 'products' | 'sale' | 'account' | 'cart' | 'wishlist'
  children: React.ReactNode
}

const ACCOUNT_MENU_ICONS: Record<PartnerSiteAccountMenuItemId, LucideIcon> = {
  account: UserRound,
  'edit-profile': Pencil,
  cart: ShoppingBag,
  orders: ClipboardList,
  'recently-viewed': Clock,
  addresses: MapPin,
}

function PartnerSiteShopShellInner({
  siteSlug,
  title,
  logoUrl,
  theme,
  locale,
  tracking,
  activeNav = 'products',
  children,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const n = getPartnerSiteCategoryNavLabels(locale)
  const paths = getPartnerSiteShopNavPaths(siteSlug)
  const accountMenuItems = getPartnerSiteAccountMenuItems({ siteSlug, locale })
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const { cartCount, setCartCount, registerCartLoader } = usePartnerSiteShop()
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const categoriesRef = useRef<HTMLDivElement | null>(null)
  const accountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!categoriesOpen && !accountOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (categoriesOpen && !categoriesRef.current?.contains(event.target as Node)) {
        setCategoriesOpen(false)
      }
      if (accountOpen && !accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCategoriesOpen(false)
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [categoriesOpen, accountOpen])

  const loadCartCount = useCallback(async (): Promise<number> => {
    const res = await fetch(partnerSiteCartApiPath(siteSlug), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    const json = (await res.json().catch(() => ({}))) as { items?: unknown[] }
    const count = Array.isArray(json.items) ? json.items.length : 0
    setCartCount(count)
    return count
  }, [authHeaders, captureFromResponse, setCartCount, siteSlug])

  useEffect(() => {
    registerCartLoader(loadCartCount)
  }, [loadCartCount, registerCartLoader])

  useEffect(() => {
    if (!ready) return
    void loadCartCount()
  }, [loadCartCount, ready])

  return (
    <div className="pw-shop">
      <PartnerSiteShopTrackingBootstrap tracking={tracking} />
      <style dangerouslySetInnerHTML={{ __html: buildPartnerSiteShopThemeCss(theme) }} />

      <div className="pw-shop-topbar">
        <div className="pw-shop-topbar-inner">
          <Link href={paths.contact}>{n.contact}</Link>
          <Link href={paths.wishlist}>{t.navFavorites}</Link>
          <Link href={paths.account}>{n.login}</Link>
        </div>
      </div>

      <header className="pw-shop-header">
        <div className="pw-shop-header-inner">
          <div className="pw-shop-brand-cluster" ref={categoriesRef}>
            <button
              type="button"
              className="pw-shop-cat-btn"
              aria-expanded={categoriesOpen}
              aria-controls="pw-shop-cat-panel"
              onClick={() => {
                setCategoriesOpen((open) => !open)
                setAccountOpen(false)
              }}
            >
              <Menu className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
              <span>{t.navCategories}</span>
            </button>
            {logoUrl ? (
              <Link href={paths.home}>
                <img className="pw-shop-logo" src={logoUrl} alt={title} />
              </Link>
            ) : (
              <Link href={paths.home} className="pw-shop-brand">
                {title}
              </Link>
            )}
            {categoriesOpen ? (
              <nav id="pw-shop-cat-panel" className="pw-shop-cat-panel" aria-label={t.navCategories}>
                <Link href={paths.products} onClick={() => setCategoriesOpen(false)}>
                  {n.newArrivals}
                </Link>
                <Link href={paths.products} onClick={() => setCategoriesOpen(false)}>
                  {n.clothing}
                </Link>
                <Link href={paths.products} onClick={() => setCategoriesOpen(false)}>
                  {n.bags}
                </Link>
                <Link href={paths.products} onClick={() => setCategoriesOpen(false)}>
                  {n.shoes}
                </Link>
                <Link href={paths.products} onClick={() => setCategoriesOpen(false)}>
                  {n.accessories}
                </Link>
                <Link href={paths.sale} className="is-sale" onClick={() => setCategoriesOpen(false)}>
                  {n.sale}
                </Link>
              </nav>
            ) : null}
          </div>

          <PartnerSiteShopSearchBar siteSlug={siteSlug} locale={locale} />

          <div className="pw-shop-header-actions">
            <div className="pw-shop-account-wrap" ref={accountRef}>
              <button
                type="button"
                className="pw-shop-icon-btn"
                aria-expanded={accountOpen}
                aria-controls="pw-shop-account-panel"
                aria-label={t.navAccount}
                onClick={() => {
                  setAccountOpen((open) => !open)
                  setCategoriesOpen(false)
                }}
              >
                <UserRound className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
                <span className="pw-shop-icon-label">{t.navAccount}</span>
              </button>
              {accountOpen ? (
                <nav id="pw-shop-account-panel" className="pw-shop-account-panel" aria-label={t.navAccount}>
                  {accountMenuItems.map((item) => {
                    const Icon = ACCOUNT_MENU_ICONS[item.id]
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={
                          item.isHeader ? 'is-header' : item.isAccent ? 'is-accent' : undefined
                        }
                        onClick={() => setAccountOpen(false)}
                      >
                        <Icon className="pw-shop-account-icon" aria-hidden="true" strokeWidth={2} />
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </nav>
              ) : null}
            </div>
            <Link href={paths.cart} className="pw-shop-icon-btn" aria-label={t.navCart}>
              <ShoppingBag className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
              <span className="pw-shop-icon-label">{t.navCart}</span>
              {cartCount > 0 ? (
                <span className="pw-shop-cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
              ) : null}
            </Link>
          </div>
        </div>
        <nav className="pw-shop-nav-row" aria-label="Shop">
          <Link href={paths.products}>{n.newArrivals}</Link>
          <Link href={paths.products}>{n.clothing}</Link>
          <Link href={paths.products}>{n.bags}</Link>
          <Link href={paths.products}>{n.shoes}</Link>
          <Link href={paths.products}>{n.accessories}</Link>
          <Link href={paths.sale} className="is-sale">
            {n.sale}
          </Link>
        </nav>
      </header>

      <main className="pw-shop-main">{children}</main>

      <footer className="pw-shop-footer">
        <div className="pw-shop-footer-inner">
          <div>
            <h3>{n.about}</h3>
            <Link href={partnerSiteInfoPath(siteSlug, 'about')}>{n.about}</Link>
            <Link href={paths.contact}>{n.contact}</Link>
          </div>
          <div>
            <h3>{t.navProducts}</h3>
            <Link href={paths.products}>{t.navProducts}</Link>
            <Link href={paths.sale}>{n.sale}</Link>
            <Link href={paths.wishlist}>{t.navFavorites}</Link>
          </div>
          <div>
            <h3>{n.faq}</h3>
            <Link href={partnerSiteInfoPath(siteSlug, 'faq')}>{n.faq}</Link>
            <Link href={partnerSiteInfoPath(siteSlug, 'shipping')}>{n.shipping}</Link>
            <Link href={partnerSiteInfoPath(siteSlug, 'returns')}>{n.returns}</Link>
          </div>
          <div>
            <h3>{n.privacy}</h3>
            <Link href={partnerSiteInfoPath(siteSlug, 'privacy')}>{n.privacy}</Link>
            <Link href={partnerSiteInfoPath(siteSlug, 'terms')}>{n.terms}</Link>
            <p>{title}</p>
          </div>
        </div>
      </footer>

      <nav className="pw-shop-bottom-nav" aria-label="Mobile">
        <Link href={paths.home} className={activeNav === 'home' ? 'is-active' : undefined}>
          <Home className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{t.navHome}</span>
        </Link>
        <Link href={paths.products} className={activeNav === 'products' ? 'is-active' : undefined}>
          <Package className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{t.navProducts}</span>
        </Link>
        <Link href={paths.sale} className={activeNav === 'sale' ? 'is-active' : undefined}>
          <Tag className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{n.sale}</span>
        </Link>
        <Link href={paths.account} className={activeNav === 'account' ? 'is-active' : undefined}>
          <UserRound className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{t.navAccount}</span>
        </Link>
      </nav>
    </div>
  )
}

export function PartnerSiteShopShell(props: Props) {
  return (
    <PartnerSiteChatWidgetProvider
      chatPath={props.chatPath}
      shopName={props.title}
      logoUrl={props.logoUrl}
      locale={props.locale}
    >
      <PartnerSiteShopProvider tracking={props.tracking}>
        <PartnerSiteShopShellInner {...props} />
      </PartnerSiteShopProvider>
    </PartnerSiteChatWidgetProvider>
  )
}
