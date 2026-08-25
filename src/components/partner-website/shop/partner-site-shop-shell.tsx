'use client'

import Link from 'next/link'
import {
  Bell,
  Heart,
  Home,
  Menu,
  MessageCircle,
  Package,
  ShoppingBag,
  UserRound,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import {
  PartnerSiteChatWidgetProvider,
  usePartnerSiteChatWidget,
} from '@/components/partner-website/shop/partner-site-chat-widget-provider'
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
  partnerSiteNotificationsApiPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  resolvePartnerCategoryDisplayName,
  type PartnerCategoryTreeNode,
} from '@/lib/partner-website/category/partner-category-types'
import {
  getPartnerSiteCategoryNavLabels,
  getPartnerSiteShopNavPaths,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import {
  DEFAULT_PARTNER_SITE_FOOTER_LINKS,
  PARTNER_SITE_FOOTER_COLUMN_ORDER,
  groupPartnerSiteFooterLinks,
  normalizePartnerSiteNavLinks,
  resolvePartnerSiteNavHref,
  visibleSortedNavLinks,
} from '@/lib/partner-website/shop/partner-site-nav-footer'
import { buildPartnerSiteChromeToggleBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-chrome-toggle-bootstrap-script'
import { buildPartnerSiteSearchBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-search-bootstrap-script'
import { buildPartnerSiteShopActionsBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-shop-actions-bootstrap-script'
import { buildPartnerSiteShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import {
  PARTNER_SHOP_CHROME_LAYOUT_CSS,
  PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID,
  PARTNER_SHOP_LOGO_HOST_SCRIPT,
  PARTNER_SHOP_LOGO_HOST_SCRIPT_ID,
} from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import {
  extractVisualDocumentCssText,
  extractVisualDocumentStyleLinks,
} from '@/lib/partner-website/shop/merge-visual-home-styles'
import {
  VISUAL_HOME_CHROME_SPLIT_CSS,
  hasVisualHomeChrome,
  pickVisualHomeChrome,
  visualChromeAfterMain,
  visualChromeBeforeMain,
  type VisualHomeChromeByDevice,
} from '@/lib/partner-website/shop/visual-home-chrome'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { htmlHasChromeChatMua } from '@/lib/partner-website/visual-editor/chrome-widgets'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import {
  buildPartnerShopLoginHref,
  getPartnerShopBrowserReturnLocation,
} from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import {
  PartnerSiteShopProvider,
  usePartnerSiteShop,
} from '@/lib/partner-website/shop/partner-site-shop-context'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { PW_EL, PW_REGION, type PwPageKind } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { PartnerSiteContactChannelsFab } from '@/components/partner-website/shop/partner-site-contact-channels-fab'
import {
  partnerSitePwaScope,
  partnerSitePwaStartUrl,
  partnerSitePwaSwPath,
} from '@/lib/partner-website/shop/partner-site-pwa'
import { ensurePartnerPwaInstallListener } from '@/lib/partner-website/shop/partner-site-pwa-install'
import { PW_SHOP_NOTIFICATIONS_REFRESH_EVENT } from '@/lib/partner-website/shop/partner-site-push-subscribe-client'

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
  /** Sửa nhanh — loại trang (home / listing / …). */
  pageKind?: PwPageKind
  /** W2.3 — optional merchant nav/footer overrides. */
  navJson?: unknown | null
  footerJson?: unknown | null
  /** Homepage visual HTML chrome, copied onto every React shop page of that device. */
  visualChromeByDevice?: VisualHomeChromeByDevice | null
  visualChromeStyles?: string
  previewDevice?: VisualDeviceVariant | null
  children: React.ReactNode
}

function mountHtmlBootstraps(hostId: string, html: string) {
  if (typeof document === 'undefined') return
  if (document.getElementById(hostId)) return
  const host = document.createElement('div')
  host.id = hostId
  host.setAttribute('hidden', '')
  host.innerHTML = html
  document.body.appendChild(host)
  host.querySelectorAll('script').forEach((old) => {
    const next = document.createElement('script')
    next.textContent = old.textContent
    Array.from(old.attributes).forEach((attr) => next.setAttribute(attr.name, attr.value))
    old.replaceWith(next)
  })
}

function VisualHomeChromeRuntime({
  siteSlug,
  locale,
}: {
  siteSlug: string
  locale: WebLocale
}) {
  useEffect(() => {
    mountHtmlBootstraps(
      `pw-visual-home-chrome-runtime-${siteSlug}`,
      [
        buildPartnerSiteChromeToggleBootstrapScript({ siteSlug, locale }),
        buildPartnerSiteSearchBootstrapScript({ siteSlug, locale }),
        buildPartnerSiteShopActionsBootstrapScript({ siteSlug, locale }),
      ].join('\n')
    )
    if (!document.getElementById(PARTNER_SHOP_LOGO_HOST_SCRIPT_ID)) {
      const s = document.createElement('script')
      s.id = PARTNER_SHOP_LOGO_HOST_SCRIPT_ID
      s.textContent = PARTNER_SHOP_LOGO_HOST_SCRIPT
      document.body.appendChild(s)
    }
    // React may paint chrome after the first bootstrap tick — refresh badge APIs + toggles.
    const t1 = window.setTimeout(() => {
      document.dispatchEvent(new Event('pw-cart-updated'))
      document.dispatchEvent(new Event('pw-shop-notifications-refresh'))
    }, 60)
    const t2 = window.setTimeout(() => {
      document.dispatchEvent(new Event('pw-cart-updated'))
    }, 400)
    const t3 = window.setTimeout(() => {
      document.dispatchEvent(new Event('pw-cart-updated'))
    }, 1200)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [locale, siteSlug])
  return null
}

function visualHomeChromeHtml(
  byDevice: VisualHomeChromeByDevice,
  previewDevice: VisualDeviceVariant | null,
  slot: 'before' | 'after'
): { html: string; split: boolean } {
  const slice = (chrome: NonNullable<ReturnType<typeof pickVisualHomeChrome>>) =>
    slot === 'before' ? visualChromeBeforeMain(chrome) : visualChromeAfterMain(chrome)
  if (previewDevice) {
    const chrome = pickVisualHomeChrome(byDevice, previewDevice)
    return { html: chrome ? slice(chrome) : '', split: false }
  }
  const desk = byDevice.desktop ? slice(byDevice.desktop) : ''
  const lap = byDevice.laptop ? slice(byDevice.laptop) : desk
  const tab = byDevice.tablet ? slice(byDevice.tablet) : lap || desk
  const mob = byDevice.mobile ? slice(byDevice.mobile) : tab || lap || desk
  const parts: string[] = []
  if (desk) parts.push(`<div class="pw-visual-desktop" data-pw-visual-device="desktop">${desk}</div>`)
  if (lap) parts.push(`<div class="pw-visual-laptop" data-pw-visual-device="laptop">${lap}</div>`)
  if (tab) parts.push(`<div class="pw-visual-tablet" data-pw-visual-device="tablet">${tab}</div>`)
  if (mob) parts.push(`<div class="pw-visual-mobile" data-pw-visual-device="mobile">${mob}</div>`)
  return { html: parts.join('\n'), split: parts.length > 1 }
}

function VisualHomeDocumentStyles({ html }: { html: string }) {
  if (!html.trim()) return null
  const css = extractVisualDocumentCssText(html)
  const links = extractVisualDocumentStyleLinks(html)
  if (!css && links.length === 0) return null
  return (
    <>
      {links.map((link) => (
        <link
          key={`${link.rel}:${link.href}`}
          rel={link.rel}
          href={link.href}
          {...(link.as ? { as: link.as } : {})}
          {...(link.crossOrigin ? { crossOrigin: link.crossOrigin } : {})}
          data-pw-home-chrome-css="1"
        />
      ))}
      {css ? <style data-pw-home-chrome-css="1" dangerouslySetInnerHTML={{ __html: css }} /> : null}
    </>
  )
}

function visualChromeHasChatMua(byDevice?: VisualHomeChromeByDevice | null): boolean {
  if (!byDevice) return false
  return [byDevice.desktop, byDevice.laptop, byDevice.tablet, byDevice.mobile].some(
    (chrome) =>
      Boolean(chrome) &&
      htmlHasChromeChatMua(`${chrome!.topbar}${chrome!.header}${chrome!.footer}${chrome!.bottomNav}${chrome!.floats}`)
  )
}

function PartnerSiteShopShellInner({
  siteSlug,
  title,
  logoUrl,
  theme,
  locale,
  tracking,
  activeNav = 'products',
  pageKind,
  footerJson = null,
  visualChromeByDevice = null,
  visualChromeStyles = '',
  previewDevice = null,
  children,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const n = getPartnerSiteCategoryNavLabels(locale)
  const { openChat } = usePartnerSiteChatWidget()
  const customDomain = usePartnerSiteCustomDomain()
  const paths = getPartnerSiteShopNavPaths(siteSlug, customDomain)
  const [loginHref, setLoginHref] = useState(paths.login)
  useEffect(() => {
    setLoginHref(
      buildPartnerShopLoginHref(
        siteSlug,
        getPartnerShopBrowserReturnLocation(siteSlug, { customDomain }),
        { customDomain }
      )
    )
  }, [customDomain, siteSlug])
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
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const categoriesRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!categoriesOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!categoriesRef.current?.contains(event.target as Node)) {
        setCategoriesOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCategoriesOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [categoriesOpen])

  const loadCartCount = useCallback(async (): Promise<number> => {
    const res = await fetch(partnerSiteCartApiPath(siteSlug), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    const json = (await res.json().catch(() => ({}))) as { items?: Array<{ quantity?: number }> }
    const count = Array.isArray(json.items)
      ? json.items.reduce((sum, item) => sum + Math.max(0, Number(item?.quantity) || 1), 0)
      : 0
    setCartCount(count)
    return count
  }, [authHeaders, captureFromResponse, setCartCount, siteSlug])

  useEffect(() => {
    registerCartLoader(loadCartCount)
  }, [loadCartCount, registerCartLoader])

  useEffect(() => {
    if (!ready) return
    void loadCartCount().then(() => {
      document.dispatchEvent(new Event('pw-cart-updated'))
    })
  }, [loadCartCount, ready])

  useEffect(() => {
    if (!ready || !isAuthenticated) {
      setUnreadNotifications(0)
      return
    }
    let cancelled = false
    const loadUnread = async () => {
      const res = await fetch(partnerSiteNotificationsApiPath(siteSlug, { unread: true }), {
        credentials: 'same-origin',
        headers: authHeaders(),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as { unreadCount?: number }
      if (!cancelled) {
        setUnreadNotifications(Math.max(0, Number(json.unreadCount ?? 0) || 0))
        document.dispatchEvent(new Event('pw-shop-notifications-refresh'))
      }
    }
    void loadUnread()
    const id = window.setInterval(() => void loadUnread(), 60_000)
    const onRefresh = () => {
      void loadUnread()
    }
    window.addEventListener(PW_SHOP_NOTIFICATIONS_REFRESH_EVENT, onRefresh)
    return () => {
      cancelled = true
      window.clearInterval(id)
      window.removeEventListener(PW_SHOP_NOTIFICATIONS_REFRESH_EVENT, onRefresh)
    }
  }, [authHeaders, captureFromResponse, isAuthenticated, ready, siteSlug])

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
  const useVisualChrome = hasVisualHomeChrome(visualChromeByDevice)
  const visualBefore =
    useVisualChrome && visualChromeByDevice
      ? visualHomeChromeHtml(visualChromeByDevice, previewDevice, 'before')
      : null
  const visualAfter =
    useVisualChrome && visualChromeByDevice
      ? visualHomeChromeHtml(visualChromeByDevice, previewDevice, 'after')
      : null

  return (
    <div className="pw-shop" {...(pageKind ? { 'data-pw-page': pageKind } : {})}>
      <PartnerSiteShopTrackingBootstrap tracking={tracking} />
      <PartnerSiteCookieConsentBanner siteSlug={siteSlug} locale={locale} />
      <style dangerouslySetInnerHTML={{ __html: buildPartnerSiteShopThemeCss(theme) }} />
      {useVisualChrome ? (
        <>
          <style
            id={PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID}
            dangerouslySetInnerHTML={{ __html: PARTNER_SHOP_CHROME_LAYOUT_CSS }}
          />
          {visualBefore?.split || visualAfter?.split ? (
            <style dangerouslySetInnerHTML={{ __html: VISUAL_HOME_CHROME_SPLIT_CSS }} />
          ) : null}
          <VisualHomeChromeRuntime siteSlug={siteSlug} locale={locale} />
          <VisualHomeDocumentStyles html={visualChromeStyles} />
          {visualBefore?.html ? (
            <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: visualBefore.html }} />
          ) : null}
        </>
      ) : (
      <>
      <div className="pw-shop-topbar" data-pw-region={PW_REGION.topbar}>
        <div className="pw-shop-topbar-inner">
          <Link href={partnerSiteAccountTabPath(siteSlug, 'contact', { customDomain })} data-pw-el={PW_EL.link}>{n.contact}</Link>
          <Link href={partnerSiteAccountTabPath(siteSlug, 'wishlist', { customDomain })} data-pw-el={PW_EL.link}>{t.navFavorites}</Link>
          <Link href={partnerSiteAccountTabPath(siteSlug, 'orders', { customDomain })} data-pw-el={PW_EL.link}>{t.navOrders}</Link>
          {!isAuthenticated ? <Link href={loginHref} data-pw-el={PW_EL.link}>{n.login}</Link> : null}
        </div>
      </div>

      <header className="pw-shop-header" data-pw-region={PW_REGION.header}>
        <div className="pw-shop-header-inner">
          <div className="pw-shop-brand-cluster" ref={categoriesRef}>
            <button
              type="button"
              className="pw-shop-cat-btn"
              data-pw-el={PW_EL.catToggle}
              aria-expanded={categoriesOpen}
              aria-controls="pw-shop-cat-panel"
                onClick={() => {
                  setCategoriesOpen((open) => !open)
                }}
            >
              <Menu className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
              <span>{t.navCategories}</span>
            </button>
            {logoUrl ? (
              <Link href={paths.home}>
                <img className="pw-shop-logo" data-pw-el={PW_EL.logo} src={logoUrl} alt={title} />
              </Link>
            ) : (
              <Link href={paths.home} className="pw-shop-brand" data-pw-el={PW_EL.wordmark}>
                {title}
              </Link>
            )}
            {categoriesOpen ? (
              <nav id="pw-shop-cat-panel" className="pw-shop-cat-panel" aria-label={t.navCategories}>
                {hasCategoryTree ? (
                  <>
                    <Link href={paths.products} data-pw-el={PW_EL.navLink} onClick={() => setCategoriesOpen(false)}>
                      {n.newArrivals}
                    </Link>
                    {categoryTree!.map((cat) => (
                      <Link
                        key={cat.id}
                        href={partnerSiteCategoryPath(siteSlug, cat.path, { customDomain })}
                        data-pw-el={PW_EL.navLink}
                        onClick={() => setCategoriesOpen(false)}
                      >
                        {resolvePartnerCategoryDisplayName(cat, locale)}
                      </Link>
                    ))}
                  </>
                ) : (
                  <>
                    <Link href={paths.products} data-pw-el={PW_EL.navLink} onClick={() => setCategoriesOpen(false)}>
                      {n.newArrivals}
                    </Link>
                    <Link href={paths.products} data-pw-el={PW_EL.navLink} onClick={() => setCategoriesOpen(false)}>
                      {n.clothing}
                    </Link>
                    <Link href={paths.products} data-pw-el={PW_EL.navLink} onClick={() => setCategoriesOpen(false)}>
                      {n.bags}
                    </Link>
                    <Link href={paths.products} data-pw-el={PW_EL.navLink} onClick={() => setCategoriesOpen(false)}>
                      {n.shoes}
                    </Link>
                    <Link href={paths.products} data-pw-el={PW_EL.navLink} onClick={() => setCategoriesOpen(false)}>
                      {n.accessories}
                    </Link>
                  </>
                )}
                <Link href={paths.sale} className="is-sale" data-pw-el={PW_EL.navLink} onClick={() => setCategoriesOpen(false)}>
                  {n.sale}
                </Link>
              </nav>
            ) : null}
          </div>

          <PartnerSiteShopSearchBar siteSlug={siteSlug} locale={locale} />

          <div className="pw-shop-header-actions">
            <Link
              href={paths.account}
              className="pw-shop-icon-btn"
              data-pw-el={PW_EL.account}
              data-pw-chrome-btn="account"
              aria-label={t.navAccount}
              onClick={() => setCategoriesOpen(false)}
            >
              <UserRound className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
              <span className="pw-shop-icon-label">{t.navAccount}</span>
            </Link>
            <Link
              href={partnerSiteAccountTabPath(siteSlug, 'notifications', { customDomain })}
              className="pw-shop-icon-btn"
              aria-label={t.accountNotifications}
            >
              <Bell className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
              <span className="pw-shop-icon-label">{t.accountNotifications}</span>
              {unreadNotifications > 0 ? (
                <span className="pw-shop-cart-badge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>
              ) : null}
            </Link>
            <Link href={partnerSiteAccountTabPath(siteSlug, 'wishlist', { customDomain })} className="pw-shop-icon-btn" aria-label={t.navFavorites}>
              <Heart className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
              <span className="pw-shop-icon-label">{t.navFavorites}</span>
            </Link>
            <button
              type="button"
              className="pw-shop-icon-btn pw-chat-open pw-chrome-icon-only"
              data-pw-chrome-btn="chat"
              data-pw-chrome-float="1"
              data-nanoai-open-chat=""
              {...(theme.chatIconLogoUrl ? { 'data-pw-chat-icon-logo': '1' } : {})}
              aria-label={t.navChat}
              onClick={() => openChat()}
            >
              <span className="pw-chrome-icon-wrap">
                {theme.chatIconLogoUrl || logoUrl ? (
                  <img
                    src={theme.chatIconLogoUrl || logoUrl || ''}
                    alt=""
                    className="pw-chrome-chat-logo"
                    width={22}
                    height={22}
                    draggable={false}
                  />
                ) : (
                  <MessageCircle className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
                )}
              </span>
              <span className="pw-shop-icon-label">{t.navChat}</span>
            </button>
            <Link href={partnerSiteAccountTabPath(siteSlug, 'cart', { customDomain })} className="pw-shop-icon-btn" data-pw-el={PW_EL.cart} aria-label={t.navCart}>
              <ShoppingBag className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
              <span className="pw-shop-icon-label">{t.navCart}</span>
              {cartCount > 0 ? (
                <span className="pw-shop-cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
              ) : null}
            </Link>
          </div>
        </div>
        <nav className="pw-shop-nav-row" data-pw-region={PW_REGION.nav} aria-label="Shop">
          <Link href={paths.products} data-pw-el={PW_EL.navLink}>{n.newArrivals}</Link>
          {hasCategoryTree ? (
            categoryTree!.map((cat) => (
              <Link key={cat.id} href={partnerSiteCategoryPath(siteSlug, cat.path, { customDomain })} data-pw-el={PW_EL.navLink}>
                {resolvePartnerCategoryDisplayName(cat, locale)}
              </Link>
            ))
          ) : (
            <>
              <Link href={paths.products} data-pw-el={PW_EL.navLink}>{n.clothing}</Link>
              <Link href={paths.products} data-pw-el={PW_EL.navLink}>{n.bags}</Link>
              <Link href={paths.products} data-pw-el={PW_EL.navLink}>{n.shoes}</Link>
              <Link href={paths.products} data-pw-el={PW_EL.navLink}>{n.accessories}</Link>
            </>
          )}
          <Link href={paths.sale} className="is-sale" data-pw-el={PW_EL.navLink}>
            {n.sale}
          </Link>
        </nav>
      </header>
      </>
      )}

      <main className="pw-shop-main">{children}</main>

      {useVisualChrome ? (
        visualAfter?.html ? (
          <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: visualAfter.html }} />
        ) : null
      ) : (
      <>
      <footer className="pw-shop-footer" data-pw-region={PW_REGION.footer} data-pw-bg-role="footer" data-pw-token="footer" data-pw-footer="full">
        <div className="pw-shop-footer-inner">
          <div className="pw-shop-footer-brand">
            {logoUrl ? (
              <Link href={paths.home}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="pw-shop-footer-logo" data-pw-el={PW_EL.logo} src={logoUrl} alt={title} />
              </Link>
            ) : null}
            <p className="pw-shop-footer-name">{title}</p>
            <p className="pw-shop-footer-hint">{t.footerBrandHint}</p>
          </div>
          {PARTNER_SITE_FOOTER_COLUMN_ORDER.map((colId) => {
            const items = footerGroups[colId]
            if (!items.length) return null
            const heading = footerColumnTitle[colId]
            return (
              <nav key={colId} className="pw-shop-footer-col" data-pw-el={PW_EL.col} aria-label={heading}>
                <h3>{heading}</h3>
                <ul>
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link href={resolvePartnerSiteNavHref(item.hrefKey, paths, infoPath)} data-pw-el={PW_EL.link}>
                        {footerLabel(item.hrefKey, item.labelOverride)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )
          })}
        </div>
        <div className="pw-shop-footer-bar" data-pw-el={PW_EL.copyright}>
          <p>
            {t.footerCopyright
              .replace('{year}', String(new Date().getFullYear()))
              .replace('{shop}', title)}
          </p>
          <p>{t.footerPaymentHint}</p>
        </div>
      </footer>

      <nav className="pw-shop-bottom-nav" data-pw-region={PW_REGION.nav} aria-label="Mobile">
          <Link href={paths.home} className={activeNav === 'home' ? 'is-active' : undefined} data-pw-el={PW_EL.navLink}>
          <Home className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{t.navHome}</span>
        </Link>
        <Link href={paths.products} className={activeNav === 'products' ? 'is-active' : undefined} data-pw-el={PW_EL.navLink}>
          <Package className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{t.navProducts}</span>
        </Link>
        <Link href={partnerSiteAccountTabPath(siteSlug, 'cart', { customDomain })} className={activeNav === 'cart' ? 'is-active' : undefined} data-pw-el={PW_EL.navLink}>
          <ShoppingBag className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{t.navCart}</span>
          {cartCount > 0 ? (
            <span className="pw-shop-cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
          ) : null}
        </Link>
        <Link href={paths.account} className={activeNav === 'account' ? 'is-active' : undefined} data-pw-el={PW_EL.navLink}>
          <UserRound className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{t.navAccount}</span>
        </Link>
      </nav>
      </>
      )}

      {!useVisualChrome && theme.floatingCta?.enabled && theme.floatingCta.href ? (
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
      {!useVisualChrome ? (
        <PartnerSiteContactChannelsFab
          siteSlug={siteSlug}
          locale={locale}
          hasFloatingCta={Boolean(theme.floatingCta?.enabled && theme.floatingCta.href)}
        />
      ) : null}
    </div>
  )
}

/** Shared storefront chrome: same header, footer, and bottom nav on every page. Only `children` differs. */
export function PartnerSiteShopShell(props: Props) {
  return (
    <PartnerSiteChatWidgetProvider
      chatPath={props.chatPath}
      shopName={props.title}
      logoUrl={props.logoUrl}
      locale={props.locale}
      listenLandingPostMessage
      hideLauncher={
        props.theme.hideChatLauncher !== false ||
        !hasVisualHomeChrome(props.visualChromeByDevice) ||
        visualChromeHasChatMua(props.visualChromeByDevice)
      }
    >
      <PartnerSiteShopProvider tracking={props.tracking}>
        <PartnerSiteShopShellInner {...props} />
      </PartnerSiteShopProvider>
    </PartnerSiteChatWidgetProvider>
  )
}
