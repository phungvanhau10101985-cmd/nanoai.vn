'use client'

import Link from 'next/link'
import { Home, Menu, Package, ShoppingBag, Tag, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { PartnerSiteChatWidgetProvider } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import { PartnerSiteShopSearchBar } from '@/components/partner-website/shop/partner-site-shop-search-bar'
import { PartnerSiteShopTrackingBootstrap } from '@/components/partner-website/shop/partner-site-shop-tracking-bootstrap'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCartApiPath,
  partnerSiteCartPath,
  partnerSiteHomePath,
  partnerSiteInfoPath,
  partnerSiteOrdersPath,
  partnerSiteProductsPath,
  partnerSiteWishlistPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
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

function navLabels(locale: WebLocale) {
  if (locale === 'vi') {
    return {
      newArrivals: 'Hàng mới',
      clothing: 'Thời trang',
      bags: 'Túi xách',
      shoes: 'Giày dép',
      accessories: 'Phụ kiện',
      sale: 'Khuyến mãi',
      contact: 'Liên hệ',
      login: 'Đăng nhập',
      account: 'Tài khoản',
      about: 'Về chúng tôi',
      faq: 'FAQ',
      shipping: 'Vận chuyển',
      returns: 'Đổi trả',
      privacy: 'Bảo mật',
      terms: 'Điều khoản',
    }
  }
  if (locale === 'zh') {
    return {
      newArrivals: '新品',
      clothing: '服装',
      bags: '箱包',
      shoes: '鞋履',
      accessories: '配饰',
      sale: '促销',
      contact: '联系我们',
      login: '登录',
      account: '账户',
      about: '关于我们',
      faq: 'FAQ',
      shipping: '配送',
      returns: '退换',
      privacy: '隐私',
      terms: '条款',
    }
  }
  if (locale === 'ja') {
    return {
      newArrivals: '新着',
      clothing: 'ファッション',
      bags: 'バッグ',
      shoes: 'シューズ',
      accessories: 'アクセサリー',
      sale: 'セール',
      contact: 'お問い合わせ',
      login: 'ログイン',
      account: 'アカウント',
      about: '会社概要',
      faq: 'FAQ',
      shipping: '配送',
      returns: '返品',
      privacy: 'プライバシー',
      terms: '利用規約',
    }
  }
  if (locale === 'ko') {
    return {
      newArrivals: '신상품',
      clothing: '패션',
      bags: '가방',
      shoes: '신발',
      accessories: '액세서리',
      sale: '세일',
      contact: '문의',
      login: '로그인',
      account: '계정',
      about: '소개',
      faq: 'FAQ',
      shipping: '배송',
      returns: '교환·반품',
      privacy: '개인정보',
      terms: '이용약관',
    }
  }
  return {
    newArrivals: 'NEW ARRIVALS',
    clothing: 'CLOTHING',
    bags: 'HANDBAGS',
    shoes: 'SHOES',
    accessories: 'ACCESSORIES',
    sale: 'SALE',
    contact: 'Contact us',
    login: 'Log in',
    account: 'Account',
    about: 'About us',
    faq: 'FAQ',
    shipping: 'Shipping',
    returns: 'Returns',
    privacy: 'Privacy',
    terms: 'Terms',
  }
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
  const n = navLabels(locale)
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const { cartCount, setCartCount, registerCartLoader } = usePartnerSiteShop()
  const [categoriesOpen, setCategoriesOpen] = useState(false)
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

  const home = partnerSiteHomePath(siteSlug)
  const products = partnerSiteProductsPath(siteSlug)
  const sale = partnerSiteInfoPath(siteSlug, 'sale')
  const wishlist = partnerSiteWishlistPath(siteSlug)
  const cart = partnerSiteCartPath(siteSlug)
  const orders = partnerSiteOrdersPath(siteSlug)

  return (
    <div className="pw-shop">
      <PartnerSiteShopTrackingBootstrap tracking={tracking} />
      <style dangerouslySetInnerHTML={{ __html: buildPartnerSiteShopThemeCss(theme) }} />

      <div className="pw-shop-topbar">
        <div className="pw-shop-topbar-inner">
          <Link href={partnerSiteInfoPath(siteSlug, 'contact')}>{n.contact}</Link>
          <Link href={wishlist}>{t.navFavorites}</Link>
          <Link href={orders}>{n.login}</Link>
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
              onClick={() => setCategoriesOpen((open) => !open)}
            >
              <Menu className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
              <span>{t.navCategories}</span>
            </button>
            {logoUrl ? (
              <Link href={home}>
                <img className="pw-shop-logo" src={logoUrl} alt={title} />
              </Link>
            ) : (
              <Link href={home} className="pw-shop-brand">
                {title}
              </Link>
            )}
            {categoriesOpen ? (
              <nav id="pw-shop-cat-panel" className="pw-shop-cat-panel" aria-label={t.navCategories}>
                <Link href={products} onClick={() => setCategoriesOpen(false)}>
                  {n.newArrivals}
                </Link>
                <Link href={products} onClick={() => setCategoriesOpen(false)}>
                  {n.clothing}
                </Link>
                <Link href={products} onClick={() => setCategoriesOpen(false)}>
                  {n.bags}
                </Link>
                <Link href={products} onClick={() => setCategoriesOpen(false)}>
                  {n.shoes}
                </Link>
                <Link href={products} onClick={() => setCategoriesOpen(false)}>
                  {n.accessories}
                </Link>
                <Link href={sale} className="is-sale" onClick={() => setCategoriesOpen(false)}>
                  {n.sale}
                </Link>
              </nav>
            ) : null}
          </div>

          <PartnerSiteShopSearchBar siteSlug={siteSlug} locale={locale} />

          <div className="pw-shop-header-actions">
            <Link href={orders} className="pw-shop-icon-btn" aria-label={n.account}>
              <UserRound className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
              <span className="pw-shop-icon-label">{n.account}</span>
            </Link>
            <Link href={cart} className="pw-shop-icon-btn" aria-label={t.navCart}>
              <ShoppingBag className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
              <span className="pw-shop-icon-label">{t.navCart}</span>
              {cartCount > 0 ? (
                <span className="pw-shop-cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
              ) : null}
            </Link>
          </div>
        </div>
        <nav className="pw-shop-nav-row" aria-label="Shop">
          <Link href={products}>{n.newArrivals}</Link>
          <Link href={products}>{n.clothing}</Link>
          <Link href={products}>{n.bags}</Link>
          <Link href={products}>{n.shoes}</Link>
          <Link href={products}>{n.accessories}</Link>
          <Link href={sale} className="is-sale">
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
            <Link href={partnerSiteInfoPath(siteSlug, 'contact')}>{n.contact}</Link>
          </div>
          <div>
            <h3>{t.navProducts}</h3>
            <Link href={products}>{t.navProducts}</Link>
            <Link href={sale}>{n.sale}</Link>
            <Link href={wishlist}>{t.navFavorites}</Link>
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
        <Link href={home} className={activeNav === 'home' ? 'is-active' : undefined}>
          <Home className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{t.navHome}</span>
        </Link>
        <Link href={products} className={activeNav === 'products' ? 'is-active' : undefined}>
          <Package className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{t.navProducts}</span>
        </Link>
        <Link href={sale} className={activeNav === 'sale' ? 'is-active' : undefined}>
          <Tag className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{n.sale}</span>
        </Link>
        <Link href={orders} className={activeNav === 'account' ? 'is-active' : undefined}>
          <UserRound className="pw-shop-nav-icon" aria-hidden="true" strokeWidth={2.25} />
          <span>{n.account}</span>
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
