'use client'

import { useLayoutEffect } from 'react'
import { PartnerSiteChatWidgetProvider } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import { PartnerSiteCookieConsentBanner } from '@/components/partner-website/shop/partner-site-cookie-consent-banner'
import { PartnerSiteShopTrackingBootstrap } from '@/components/partner-website/shop/partner-site-shop-tracking-bootstrap'
import type { WebLocale } from '@/lib/i18n/config'
import { persistPartnerLiveVisualDeviceCookie } from '@/lib/partner-website/shop/infer-live-visual-request-device'
import { stripPartnerLiveHoistHosts } from '@/lib/partner-website/shop/strip-partner-live-hoist-hosts'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import {
  applyShopBrowserThemeColorToDocument,
} from '@/lib/partner-website/template/partner-website-theme-tokens'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-device-query'

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
}) {
  useLayoutEffect(() => {
    if (browserThemeColor) applyShopBrowserThemeColorToDocument(document, browserThemeColor)
    persistPartnerLiveVisualDeviceCookie(device || 'desktop', navigator.userAgent || '')
    document.documentElement.setAttribute('data-pw-visual-ready', '1')
    document.dispatchEvent(new Event('pw-shop-visual-ready'))
    return () => {
      stripPartnerLiveHoistHosts()
    }
  }, [browserThemeColor, device])

  return (
    <PartnerSiteChatWidgetProvider
      chatPath={chatPath}
      shopName={shopName}
      logoUrl={logoUrl}
      locale={locale}
      listenLandingPostMessage
      hideLauncher={hideChatLauncher}
    >
      {siteSlug ? <PartnerSiteCookieConsentBanner siteSlug={siteSlug} locale={locale} /> : null}
      {tracking ? <PartnerSiteShopTrackingBootstrap tracking={tracking} /> : null}
    </PartnerSiteChatWidgetProvider>
  )
}
