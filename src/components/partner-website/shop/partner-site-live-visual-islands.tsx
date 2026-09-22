'use client'

import { useLayoutEffect, type ReactNode } from 'react'
import { PartnerSiteChatWidgetProvider } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import { PartnerSiteCookieConsentBanner } from '@/components/partner-website/shop/partner-site-cookie-consent-banner'
import { PartnerSiteShopTrackingBootstrap } from '@/components/partner-website/shop/partner-site-shop-tracking-bootstrap'
import type { WebLocale } from '@/lib/i18n/config'
import { persistPartnerLiveVisualDeviceCookie } from '@/lib/partner-website/shop/infer-live-visual-request-device'
import {
  rememberViewedProductPage,
  viewedProductPathname,
} from '@/lib/partner-website/shop/partner-site-viewed-product-cache'
import { stripPartnerLiveHoistHosts } from '@/lib/partner-website/shop/strip-partner-live-hoist-hosts'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import {
  applyShopBrowserThemeColorToDocument,
} from '@/lib/partner-website/template/partner-website-theme-tokens'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

export function PartnerSiteLiveVisualIslands({
  siteSlug,
  locale,
  chatPath,
  shopName,
  logoUrl,
  hideChatLauncher,
  tracking,
  browserThemeColor,
  device,
  pageKind,
  children,
}: {
  siteSlug: string
  locale: WebLocale
  chatPath: string
  shopName: string
  logoUrl?: string | null
  hideChatLauncher?: boolean
  tracking?: PartnerSiteShopTrackingConfig | null
  browserThemeColor?: string
  device?: VisualDeviceVariant | null
  pageKind?: string
  children?: ReactNode
}) {
  useLayoutEffect(() => {
    if (browserThemeColor) applyShopBrowserThemeColorToDocument(document, browserThemeColor)
    persistPartnerLiveVisualDeviceCookie(device || 'desktop', navigator.userAgent || '')
    const path = window.location.pathname
    if (viewedProductPathname(path) && (!pageKind || pageKind === 'product')) {
      const timer = window.setTimeout(() => {
        const root = document.querySelector('[data-pw-inline-visual-root]')
        if (root) rememberViewedProductPage(path, root.innerHTML)
      }, 0)
      return () => {
        window.clearTimeout(timer)
        stripPartnerLiveHoistHosts()
      }
    }
    return () => {
      stripPartnerLiveHoistHosts()
    }
  }, [browserThemeColor, device, pageKind])

  return (
    <PartnerSiteChatWidgetProvider
      chatPath={chatPath}
      shopName={shopName}
      logoUrl={logoUrl}
      locale={locale}
      listenLandingPostMessage
      hideLauncher={hideChatLauncher}
    >
      {children}
      {siteSlug ? <PartnerSiteCookieConsentBanner siteSlug={siteSlug} locale={locale} /> : null}
      {tracking ? <PartnerSiteShopTrackingBootstrap tracking={tracking} /> : null}
    </PartnerSiteChatWidgetProvider>
  )
}
