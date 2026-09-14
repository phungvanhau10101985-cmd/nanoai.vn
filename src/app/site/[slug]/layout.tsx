import type { CSSProperties } from 'react'
import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { PartnerSiteGoogleAuthHandoffBoot } from '@/components/partner-website/shop/partner-site-google-auth-handoff-boot'
import { PartnerSiteShopPushBoot } from '@/components/partner-website/shop/partner-site-shop-push-boot'
import {
  FASHION_SHOP_FONT_DISPLAY,
  FASHION_SHOP_FONT_UI,
} from '@/lib/partner-website/shop/fashion-shop-design'
import { PartnerSiteSoftNavRelay } from '@/components/partner-website/shop/partner-site-soft-nav-relay'
import { PartnerSiteCustomDomainProvider } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  partnerSitePwaIconPath,
  partnerSitePwaManifestPath,
} from '@/lib/partner-website/shop/partner-site-pwa'
import { buildPartnerShopFaviconMetadataIcons } from '@/lib/partner-website/shop/inject-partner-shop-favicon'
import {
  buildPartnerSiteNativeNavigationScript,
  PARTNER_SITE_NATIVE_NAV_SCRIPT_ID,
} from '@/lib/partner-website/shop/partner-site-account-native-navigation'
import {
  shopBrowserChromeColor,
  shopBrowserThemeColorViewportItems,
} from '@/lib/partner-website/template/partner-website-theme-tokens'

export const dynamic = 'force-dynamic'

/** Do not use `next/font/google` here — VPS `next build` fetches fonts.gstatic.com and times out. */
const shopFontVars = {
  '--pw-font-display': FASHION_SHOP_FONT_DISPLAY,
  '--pw-font-ui': FASHION_SHOP_FONT_UI,
} as CSSProperties

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const site = (await loadPartnerSiteShopContext(slug).catch(() => null))?.site ?? null
  if (!site) return {}
  const headerStore = headers()
  const customDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))
  const name = site.title.trim() || site.partnerDisplayName || 'Shop'
  const icons = buildPartnerShopFaviconMetadataIcons({
    siteSlug: site.siteSlug,
    customDomain,
    faviconUrl: site.theme.faviconUrl,
    logoUrl: site.logoUrl,
  })

  return {
    applicationName: name,
    manifest: partnerSitePwaManifestPath(
      site.siteSlug,
      customDomain,
      shopBrowserChromeColor(site.theme).slice(1)
    ),
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: name,
    },
    icons,
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': name,
    },
  }
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Viewport> {
  const headerStore = headers()
  void headerStore
  const { slug } = await params
  const site = (await loadPartnerSiteShopContext(slug).catch(() => null))?.site ?? null
  return {
    width: 'device-width',
    initialScale: 1,
    minimumScale: 1,
    maximumScale: 5,
    viewportFit: 'cover',
    themeColor: shopBrowserThemeColorViewportItems(site ? site.theme : '#ffffff'),
  }
}

export default async function PartnerSiteSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const headerStore = headers()
  const onCustomDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))
  const site = (await loadPartnerSiteShopContext(slug).catch(() => null))?.site ?? null
  const name = site?.title.trim() || site?.partnerDisplayName || ''
  const icon180 = site ? partnerSitePwaIconPath(site.siteSlug, 180, onCustomDomain) : ''
  const nativeNavSlug = site?.siteSlug || slug

  return (
    <>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__nanoaiShopPwaPrompt=e;});',
          }}
        />
        {nativeNavSlug ? (
          <script
            id={PARTNER_SITE_NATIVE_NAV_SCRIPT_ID}
            dangerouslySetInnerHTML={{
              __html: buildPartnerSiteNativeNavigationScript(nativeNavSlug),
            }}
          />
        ) : null}
        {name ? <meta name="apple-mobile-web-app-title" content={name} /> : null}
        {icon180 ? <link rel="apple-touch-icon" href={icon180} /> : null}
      </head>
      <PartnerSiteCustomDomainProvider active={onCustomDomain}>
        <PartnerSiteSoftNavRelay />
        <PartnerSiteGoogleAuthHandoffBoot siteSlug={site?.siteSlug || slug} />
        <PartnerSiteShopPushBoot siteSlug={site?.siteSlug || slug} />
        <div style={shopFontVars}>{children}</div>
      </PartnerSiteCustomDomainProvider>
    </>
  )
}
