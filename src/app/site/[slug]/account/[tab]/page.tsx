import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteShopAccountClient } from '@/components/partner-website/shop/partner-site-shop-account-client'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { liveVisualHomeChromeShellProps } from '@/lib/partner-website/shop/live-visual-home-chrome'
import {
  isPartnerSiteAccountTab,
  type PartnerSiteAccountTab,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { readVisualPreviewDevice } from '@/components/partner-website/shop/partner-site-visual-html-screen'

type Props = {
  params: Promise<{ slug: string; tab: string }>
  searchParams?: Promise<{ tab?: string; 'pw-device'?: string }>
}

/** Overview lives at `/account` — reject `overview` as a path segment. */
const ROUTE_TABS = new Set<PartnerSiteAccountTab>([
  'cart',
  'orders',
  'wallet',
  'wishlist',
  'recently-viewed',
  'addresses',
  'edit-profile',
  'contact',
  'security',
  'notifications',
  'install-app',
])

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, tab } = await params
  const normalized = tab.trim().toLowerCase()
  if (!isPartnerSiteAccountTab(normalized) || !ROUTE_TABS.has(normalized)) {
    return buildMetadata({
      title: 'Account',
      description: 'Account',
      path: `/site/${slug}/account/${tab}`,
      noIndex: true,
    })
  }
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Account',
      description: 'Account',
      path: `/site/${slug}/account/${normalized}`,
      noIndex: true,
    })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Account`,
    description: shop.site.partnerDisplayName,
    path: `/account/${normalized}`,
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteAccountTabPage({ params, searchParams }: Props) {
  const { slug, tab } = await params
  const normalized = tab.trim().toLowerCase()
  if (!isPartnerSiteAccountTab(normalized) || !ROUTE_TABS.has(normalized)) notFound()

  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const site = shop.site
  const partnerSlug = shop.partnerSlug
  if (!partnerSlug.trim()) notFound()
  const shellSite = site
  const device = await readVisualPreviewDevice(searchParams)

  const sp = (await searchParams) ?? {}
  const ordersFilter = normalized === 'orders' ? sp.tab?.trim() || null : null

  return (
    <PartnerSiteShopShell
      siteSlug={shellSite.siteSlug}
      partnerSlug={partnerSlug}
      title={shellSite.title}
      logoUrl={shellSite.logoUrl}
      theme={shellSite.theme}
      locale={shellSite.locale}
      chatPath={shellSite.chatPath}
      tracking={partnerSiteTrackingFromPublicRow(shellSite)}
      footerJson={shellSite.footerJson}
      navJson={shellSite.navJson}
      activeNav="account"
      pageKind={PW_PAGE.account}
      {...(await liveVisualHomeChromeShellProps(shellSite, device))}
    >
      <PartnerSiteShopAccountClient
        siteSlug={shellSite.siteSlug}
        partnerSlug={partnerSlug}
        shopTitle={shellSite.title}
        locale={shellSite.locale}
        initialTab={normalized}
        initialOrdersFilter={ordersFilter}
      />
    </PartnerSiteShopShell>
  )
}
