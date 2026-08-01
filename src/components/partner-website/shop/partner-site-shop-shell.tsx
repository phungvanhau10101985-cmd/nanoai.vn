'use client'

import Link from 'next/link'
import { useCallback, useEffect } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { PartnerSiteChatWidgetProvider, usePartnerSiteChatWidget } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCartPath,
  partnerSiteHomePath,
  partnerSiteOrdersPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { buildPartnerSiteShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import {
  PartnerSiteShopProvider,
  usePartnerSiteShop,
} from '@/lib/partner-website/shop/partner-site-shop-context'
import { PartnerSiteShopTrackingBootstrap } from '@/components/partner-website/shop/partner-site-shop-tracking-bootstrap'

type Props = {
  siteSlug: string
  partnerSlug: string
  title: string
  logoUrl: string | null
  theme: PartnerWebsiteTheme
  locale: WebLocale
  chatPath: string
  tracking: PartnerSiteShopTrackingConfig
  children: React.ReactNode
}

function PartnerSiteShopShellInner({
  siteSlug,
  partnerSlug,
  title,
  logoUrl,
  theme,
  locale,
  chatPath,
  tracking,
  children,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { openChat } = usePartnerSiteChatWidget()
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const { cartCount, setCartCount, registerCartLoader } = usePartnerSiteShop()

  const loadCartCount = useCallback(async (): Promise<number> => {
    const res = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/cart`, {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    const json = (await res.json().catch(() => ({}))) as { items?: unknown[] }
    const n = Array.isArray(json.items) ? json.items.length : 0
    setCartCount(n)
    return n
  }, [authHeaders, captureFromResponse, partnerSlug, setCartCount])

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
      <header className="pw-shop-header">
        <div className="pw-shop-header-inner">
          {logoUrl ? (
            <Link href={partnerSiteHomePath(siteSlug)}>
              <img className="pw-shop-logo" src={logoUrl} alt={title} />
            </Link>
          ) : (
            <Link href={partnerSiteHomePath(siteSlug)} className="pw-shop-brand">
              {title}
            </Link>
          )}
          <nav className="pw-shop-nav" aria-label="Shop">
            <Link href={partnerSiteHomePath(siteSlug)}>{t.navHome}</Link>
            <Link href={partnerSiteProductsPath(siteSlug)}>{t.navProducts}</Link>
            <Link href={partnerSiteOrdersPath(siteSlug)}>{t.navOrders}</Link>
            <button type="button" className="pw-shop-nav-chat pw-chat-open" onClick={() => openChat()}>
              {t.navChat}
            </button>
            <Link href={partnerSiteCartPath(siteSlug)} className="pw-shop-cart-link">
              {t.navCart}
              {cartCount > 0 ? (
                <span className="pw-shop-cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
              ) : null}
            </Link>
          </nav>
        </div>
      </header>
      <main className="pw-shop-main">{children}</main>
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
