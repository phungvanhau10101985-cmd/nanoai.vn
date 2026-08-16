import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteShopAddressesClient } from '@/components/partner-website/shop/partner-site-shop-addresses-client'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { maybePartnerSiteVisualPage } from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Addresses',
      description: 'Addresses',
      path: `/site/${slug}/addresses`,
      noIndex: true,
    })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Addresses`,
    description: shop.site.partnerDisplayName,
    path: '/addresses',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteAddressesPage({ params }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()

  const visual = maybePartnerSiteVisualPage(shop.site, 'addresses')
  if (visual) return visual

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
    >
      <PartnerSiteShopAddressesClient
        siteSlug={shop.site.siteSlug}
        partnerSlug={shop.partnerSlug}
        shopTitle={shop.site.title}
        locale={shop.site.locale}
      />
    </PartnerSiteShopShell>
  )
}
