import { notFound } from 'next/navigation'
import { PartnerSiteReactAccountShell } from '@/components/partner-website/shop/partner-site-react-account-shell'
import { inferLiveVisualRequestDevice } from '@/lib/partner-website/shop/infer-live-visual-request-device-server'
import { liveVisualHomeChromeShellProps } from '@/lib/partner-website/shop/live-visual-home-chrome'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
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

  return (
    <PartnerSiteReactAccountShell
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
      {...(await liveVisualHomeChromeShellProps(site, device))}
    >
      {children}
    </PartnerSiteReactAccountShell>
  )
}
