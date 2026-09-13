import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { readLoginNextFromHeaders } from '@/lib/auth/app-request-headers'
import { inferLiveVisualRequestDevice } from '@/lib/partner-website/shop/infer-live-visual-request-device-server'
import { liveVisualHomeChromeShellProps } from '@/lib/partner-website/shop/live-visual-home-chrome'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { reactAccountShellNavFromPathname } from '@/lib/partner-website/shop/partner-site-account-nav'
import { PARTNER_SITE_ACCOUNT_NATIVE_NAV_SCRIPT } from '@/lib/partner-website/shop/partner-site-account-native-navigation'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'

export const dynamic = 'force-dynamic'

/**
 * Cart / account / orders / addresses / login share one React shell so header, mega menu,
 * and badge fetches stay mounted while the middle column swaps.
 */
export default async function PartnerSiteAccountChromeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const partnerSlug = shop.partnerSlug.trim()
  if (!partnerSlug) notFound()
  const device = inferLiveVisualRequestDevice()
  const site = shop.site
  const headerStore = headers()
  const requestPath = readLoginNextFromHeaders((name) => headerStore.get(name)).split('?')[0] || ''
  const nav = reactAccountShellNavFromPathname(requestPath)

  return (
    <>
      <script
        id="pw-account-native-navigation"
        dangerouslySetInnerHTML={{ __html: PARTNER_SITE_ACCOUNT_NATIVE_NAV_SCRIPT }}
      />
      <PartnerSiteShopShell
        siteSlug={site.siteSlug}
        partnerSlug={partnerSlug}
        title={site.title}
        logoUrl={site.logoUrl}
        theme={site.theme}
        locale={site.locale}
        chatPath={site.chatPath}
        tracking={partnerSiteTrackingFromPublicRow(site)}
        footerJson={site.footerJson}
        navJson={site.navJson}
        pageKind={nav.pageKind}
        activeNav={nav.activeNav}
        hideAccountNav={nav.hideAccountNav}
        {...(await liveVisualHomeChromeShellProps(site, device))}
      >
        {children}
      </PartnerSiteShopShell>
    </>
  )
}
