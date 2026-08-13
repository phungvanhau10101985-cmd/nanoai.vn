'use client'

import Link from 'next/link'
import {
  Bell,
  ClipboardList,
  Clock,
  Download,
  Gift,
  Heart,
  Home,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  Pencil,
  Shield,
  ShoppingBag,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { PartnerSiteChatWidgetProvider } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import { PartnerSiteShopSearchBar } from '@/components/partner-website/shop/partner-site-shop-search-bar'
import { PartnerSiteShopTrackingBootstrap } from '@/components/partner-website/shop/partner-site-shop-tracking-bootstrap'
import { PartnerSiteCookieConsentBanner } from '@/components/partner-website/shop/partner-site-cookie-consent-banner'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteAccountTabPath,
  partnerSiteCartApiPath,
  partnerSiteCategoriesApiPath,
  partnerSiteCategoryPath,
  partnerSiteInfoPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  resolvePartnerCategoryDisplayName,
  type PartnerCategoryTreeNode,
} from '@/lib/partner-website/category/partner-category-types'
import {
  getPartnerSiteAccountMenuItems,
  getPartnerSiteCategoryNavLabels,
  getPartnerSiteShopNavPaths,
  type PartnerSiteAccountMenuItemId,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import {
  DEFAULT_PARTNER_SITE_FOOTER_LINKS,
  PARTNER_SITE_FOOTER_COLUMN_ORDER,
  groupPartnerSiteFooterLinks,
  normalizePartnerSiteNavLinks,
  resolvePartnerSiteNavHref,
  visibleSortedNavLinks,
} from '@/lib/partner-website/shop/partner-site-nav-footer'
import { buildPartnerSiteShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import {
  PartnerSiteShopProvider,
  usePartnerSiteShop,
} from '@/lib/partner-website/shop/partner-site-shop-context'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { PartnerSiteContactChannelsFab } from '@/components/partner-website/shop/partner-site-contact-channels-fab'
import {
  partnerSitePwaScope,
  partnerSitePwaStartUrl,
  partnerSitePwaSwPath,
} from '@/lib/partner-website/shop/partner-site-pwa'
import { ensurePartnerPwaInstallListener } from '@/lib/partner-website/shop/partner-site-pwa-install'

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
  /** W2.3 — optional merchant nav/footer overrides. */
  navJson?: unknown | null
  footerJson?: unknown | null
  children: React.ReactNode
}

const ACCOUNT_MENU_ICONS: Record<PartnerSiteAccountMenuItemId, LucideIcon> = {
  account: UserRound,
  'edit-profile': Pencil,
  cart: ShoppingBag,
  orders: ClipboardList,
  wallet: Gift,
  wishlist: Heart,
  'recently-viewed': Clock,
  addresses: MapPin,
  security: Shield,
  notifications: Bell,
  'install-app': Download,
  contact: MessageCircle,
}

function PartnerSiteShopShellInner({
  siteSlug,
  title,
  logoUrl,
  theme,
  locale,
  tracking,
  activeNav = 'products',
  footerJson = null,
  children,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const n = getPartnerSiteCategoryNavLabels(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const paths = getPartnerSiteShopNavPaths(siteSlug, customDomain)
  const accountMenuItems = getPartnerSiteAccountMenuItems({ siteSlug, locale, customDomain })
  const footerLinks = visibleSortedNavLinks(
    normalizePartnerSiteNavLinks(footerJson, DEFAULT_PARTNER_SITE_FOOTER_LINKS)
  )
  const footerGroups = groupPartnerSiteFooterLinks(footerLinks)
  const footerColumnTitle: Record<(typeof PARTNER_SITE_FOOTER_COLUMN_ORDER)[number], string> = {
    shop: t.footerColShop,
    shopping: t.footerColShopping,
    support: t.footerColSupport,
    legal: t.footerColLegal,
  }
  const footerLabel = (hrefKey: string, override?: string | null) => {
    if (override?.trim()) return override.trim()
    const map: Record<string, string> = {
      about: n.about,
      contact: n.contact,
      stores: n.stores,
      lookbook: n.lookbook,
      products: t.navProducts,
      sale: n.sale,
      wishlist: t.navFavorites,
      'size-guide': n.sizeGuide,
      faq: n.faq,
      shipping: n.shipping,
      returns: n.returns,
      payment: n.payment,
      privacy: n.privacy,
      terms: n.terms,
      blog: n.blog,
      home: t.navHome,
      cart: t.navCart,
      orders: t.navOrders,
      account: t.navAccount,
    }
    return map[hrefKey] || hrefKey
  }
  const infoPath = (key: string) =>
    partnerSiteInfoPath(
      siteSlug,
      key as
        | 'about'
        | 'contact'
        | 'faq'
        | 'sale'
        | 'shipping'
        | 'returns'
        | 'privacy'
        | 'terms'
        | 'payment'
        | 'thank-you'
        | 'stores'
        | 'lookbook'
        | 'size-guide'
        | 'blog',
      { customDomain }
    )
  const { ready, isAuthenticated, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const { cartCount, setCartCount, registerCartLoader } = usePartnerSiteShop()
  const [categoryTree, setCategoryTree] = useState<PartnerCategoryTreeNode[] | null>(null)
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

  // W5.5 — per-shop SW (never NanoAI public/sw.js) + capture install prompt early.
  useEffect(() => {
    ensurePartnerPwaInstallListener()
    if (!('serviceWorker' in navigator)) return
    const startUrl = partnerSitePwaStartUrl(siteSlug, customDomain)
    const swHref = partnerSitePwaSwPath(siteSlug, customDomain)
    void navigator.serviceWorker
      .register(swHref, { scope: partnerSitePwaScope(startUrl) })
      .catch(() => {
        /* PWA remains optional when worker registration is unavailable. */
      })
  }, [customDomain, siteSlug])

  // W4.8 — mega menu thật từ cây danh mục (active). Rỗng = shop chưa cấu hình danh mục
  // -> fallback nhãn cố định cũ bên dưới (W4.3, không phá site đang publish).
  useEffect(() => {
    let cancelled = false
    fetch(partnerSiteCategoriesApiPath(siteSlug), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { tree?: PartnerCategoryTreeNode[] } | null) => {
        if (!cancelled) setCategoryTree(json?.tree ?? [])
      })
      .catch(() => {
        if (!cancelled) setCategoryTree([])
      })
    return () => {
      cancelled = true
    }
  }, [siteSlug])

  const hasCategoryTree = Boolean(categoryTree && categoryTree.length > 0)

  return (
    <div className="pw-shop">
      <PartnerSiteShopTrackingBootstrap tracking={tracking} />
      <PartnerSiteCookieConsentBanner siteSlug={siteSlug} locale={locale} />
      <style dangerouslySetInnerHTML={{ __html: buildPartnerSiteShopThemeCss(theme) }} />

      <div className="pw-shop-topbar">
        <div className="pw-shop-topbar-inner">
          <Link href={partnerSiteAccountTabPath(siteSlug, 'contact', { customDomain })}>{n.contact}</Link>
          <Link href={partnerSiteAccountTabPath(siteSlug, 'wishlist', { customDomain })}>{t.navFavorites}</Link>
          <Link href={partnerSiteAccountTabPath(siteSlug, 'orders', { customDomain })}>{t.navOrders}</Link>
          {!isAuthenticated ? <Link href={paths.account}>{n.login}</Link> : null}
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
                {hasCategoryTree ? (
                  <>
                    <Link href={paths.products} onClick={() => setCategoriesOpen(false)}>
                      {n.newArrivals}
                    </Link>
                    {categoryTree!.map((cat) => (
                      <Link
                        key={cat.id}
                        href={partnerSiteCategoryPath(siteSlug, cat.path, { customDomain })}
                        onClick={() => setCategoriesOpen(false)}
                      >
                        {resolvePartnerCategoryDisplayName(cat, locale)}
                      </Link>
                    ))}
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
                  {accountMenuItems.filter((item) => !item.isHeader).map((item) => {
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
            <Link href={partnerSiteAccountTabPath(siteSlug, 'wishlist', { customDomain })} className="pw-shop-icon-btn" aria-label={t.navFavorites}>
              <Heart className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
              <span className="pw-shop-icon-label">{t.navFavorites}</span>
            </Link>
            <Link href={partnerSiteAccountTabPath(siteSlug, 'cart', { customDomain })} className="pw-shop-icon-btn" aria-label={t.navCart}>
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
          {hasCategoryTree ? (
            categoryTree!.map((cat) => (
              <Link key={cat.id} href={partnerSiteCategoryPath(siteSlug, cat.path, { customDomain })}>
                {resolvePartnerCategoryDisplayName(cat, locale)}
              </Link>
            ))
          ) : (
            <>
              <Link href={paths.products}>{n.clothing}</Link>
              <Link href={paths.products}>{n.bags}</Link>
              <Link href={paths.products}>{n.shoes}</Link>
              <Link href={paths.products}>{n.accessories}</Link>
            </>
          )}
          <Link href={paths.sale} className="is-sale">
            {n.sale}
          </Link>
        </nav>
      </header>

      <main className="pw-shop-main">{children}</main>

      <footer className="pw-shop-footer">
        <div className="pw-shop-footer-inner">
          <div className="pw-shop-footer-brand">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="pw-shop-footer-logo" src={logoUrl} alt="" />
            ) : null}
            <p className="pw-shop-footer-name">{title}</p>
            <p className="pw-shop-footer-hint">{t.footerBrandHint}</p>
          </div>
          {PARTNER_SITE_FOOTER_COLUMN_ORDER.map((colId) => {
            const items = footerGroups[colId]
            if (!items.length) return null
            const heading = footerColumnTitle[colId]
            return (
              <nav key={colId} className="pw-shop-footer-col" aria-label={heading}>
                <h3>{heading}</h3>
                <ul>
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link href={resolvePartnerSiteNavHref(item.hrefKey, paths, infoPath)}>
                        {footerLabel(item.hrefKey, item.labelOverride)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )
          })}
        </div>
        <div className="pw-shop-footer-bar">
          <p>
            {t.footerCopyright
              .replace('{year}', String(new Date().getFullYear()))
              .replace('{shop}', title)}
          </p>
          <p>{t.footerPaymentHint}</p>
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
        <Link href={partnerSiteAccountTabPath(siteSlug, 'cart', { customDomain })} className={activeNav === 'cart' ? 'is-active' : undefined}>
          <ShoppingBag className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{t.navCart}</span>
          {cartCount > 0 ? (
            <span className="pw-shop-cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
          ) : null}
        </Link>
        <Link href={paths.account} className={activeNav === 'account' ? 'is-active' : undefined}>
          <UserRound className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{t.navAccount}</span>
        </Link>
      </nav>

      {theme.floatingCta?.enabled && theme.floatingCta.href ? (
        <a
          href={theme.floatingCta.href}
          className="fixed bottom-[15.5rem] right-3 z-[2147482900] flex max-w-[11rem] items-center gap-2 rounded-full bg-[var(--pw-primary,#f97316)] px-3 py-2.5 text-sm font-semibold text-white shadow-lg md:bottom-[5.5rem] md:right-4"
          style={{ color: '#fff' }}
        >
          {theme.floatingCta.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={theme.floatingCta.imageUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : null}
          <span className="truncate">{theme.floatingCta.label || 'CTA'}</span>
        </a>
      ) : null}
      <PartnerSiteContactChannelsFab
        siteSlug={siteSlug}
        locale={locale}
        hasFloatingCta={Boolean(theme.floatingCta?.enabled && theme.floatingCta.href)}
      />
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
