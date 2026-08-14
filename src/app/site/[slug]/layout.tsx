import type { Metadata } from 'next'
import { Be_Vietnam_Pro, Fraunces } from 'next/font/google'
import { headers } from 'next/headers'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { PartnerSiteShopPushBoot } from '@/components/partner-website/shop/partner-site-shop-push-boot'
import { PartnerSiteCustomDomainProvider } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'
import {
  partnerSitePwaIconPath,
  partnerSitePwaManifestPath,
} from '@/lib/partner-website/shop/partner-site-pwa'

const display = Fraunces({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['500', '700', '800'],
  variable: '--pw-font-display',
  display: 'swap',
})

const ui = Be_Vietnam_Pro({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--pw-font-ui',
  display: 'swap',
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug).catch(() => null)
  if (!site) return {}
  const headerStore = headers()
  const customDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))
  const name = site.title.trim() || site.partnerDisplayName || 'Shop'
  const icon192 = partnerSitePwaIconPath(site.siteSlug, 192, customDomain)
  const icon180 = partnerSitePwaIconPath(site.siteSlug, 180, customDomain)

  return {
    applicationName: name,
    manifest: partnerSitePwaManifestPath(site.siteSlug, customDomain),
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: name,
    },
    icons: {
      icon: [{ url: icon192, type: 'image/png', sizes: '192x192' }],
      shortcut: [{ url: icon192, type: 'image/png' }],
      apple: [{ url: icon180, type: 'image/png', sizes: '180x180' }],
    },
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': name,
    },
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
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug).catch(() => null)
  const name = site?.title.trim() || site?.partnerDisplayName || ''
  const icon180 = site ? partnerSitePwaIconPath(site.siteSlug, 180, onCustomDomain) : ''

  return (
    <PartnerSiteCustomDomainProvider active={onCustomDomain}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__nanoaiShopPwaPrompt=e;});',
          }}
        />
        {name ? <meta name="apple-mobile-web-app-title" content={name} /> : null}
        {icon180 ? <link rel="apple-touch-icon" href={icon180} /> : null}
      </head>
      <PartnerSiteShopPushBoot siteSlug={site?.siteSlug || slug} />
      <div className={`${display.variable} ${ui.variable}`}>{children}</div>
    </PartnerSiteCustomDomainProvider>
  )
}
