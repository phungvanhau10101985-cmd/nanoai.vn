import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteShopCartClient } from '@/components/partner-website/shop/partner-site-shop-cart-client'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({ title: 'Cart', description: 'Cart', path: `/site/${slug}/cart`, noIndex: true })
  }
  return buildMetadata({
    title: `${shop.site.title} — Cart`,
    description: shop.site.partnerDisplayName,
    path: `/site/${slug}/cart`,
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteCartPage({ params }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()

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
