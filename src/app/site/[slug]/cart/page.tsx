import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteShopCartClient } from '@/components/partner-website/shop/partner-site-shop-cart-client'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { maybePartnerSiteVisualPage } from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({ title: 'Cart', description: 'Cart', path: `/site/${slug}/cart`, noIndex: true })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Cart`,
    description: shop.site.partnerDisplayName,
    path: '/cart',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteCartPage({ params }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const visual = maybePartnerSiteVisualPage(shop.site, 'cart')
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
      activeNav="cart"
      pageKind={PW_PAGE.cart}
    >
      <PartnerSiteShopCartClient
        siteSlug={shop.site.siteSlug}
        partnerSlug={shop.partnerSlug}
        shopTitle={shop.site.title}
        locale={shop.site.locale}
        chatPath={shop.site.chatPath}
      />
    </PartnerSiteShopShell>
  )
}
