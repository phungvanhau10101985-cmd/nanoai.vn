import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteShopDepositClient } from '@/components/partner-website/shop/partner-site-shop-deposit-client'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { liveVisualHomeChromeShellProps } from '@/lib/partner-website/shop/live-visual-home-chrome'
import { readVisualPreviewDevice, type PartnerSiteSearchParams } from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  params: Promise<{ slug: string; orderId: string }>
  searchParams?: PartnerSiteSearchParams
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, orderId } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Deposit',
      description: 'Deposit',
      path: `/site/${slug}/orders/${orderId}/deposit`,
      noIndex: true,
    })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Deposit`,
    description: shop.site.partnerDisplayName,
    path: `/orders/${encodeURIComponent(orderId)}/deposit`,
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteOrderDepositPage({ params, searchParams }: Props) {
  const { slug, orderId } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const id = String(orderId ?? '').trim()
  if (!id) notFound()
  const device = await readVisualPreviewDevice(searchParams)

  return (
    <PartnerSiteShopShell
      siteSlug={shop.site.siteSlug}
      partnerSlug={shop.partnerSlug}
      title={shop.site.title}
      logoUrl={shop.site.logoUrl}
      theme={shop.site.theme}
      locale={shop.site.locale}
      chatPath={shop.site.chatPath}
      tracking={partnerSiteTrackingFromPublicRow(shop.site)}
      footerJson={shop.site.footerJson}
      navJson={shop.site.navJson}
      activeNav="account"
      pageKind={PW_PAGE.account}
      {...(await liveVisualHomeChromeShellProps(shop.site, device))}
    >
      <PartnerSiteShopDepositClient
        siteSlug={shop.site.siteSlug}
        partnerSlug={shop.partnerSlug}
        locale={shop.site.locale}
        orderId={id}
        shopTitle={shop.site.title}
      />
    </PartnerSiteShopShell>
  )
}
