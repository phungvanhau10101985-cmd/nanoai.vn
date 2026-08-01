import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteShopCatalogClient } from '@/components/partner-website/shop/partner-site-shop-catalog-client'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { fetchPartnerInventoryActivePageWithCountFromPg } from '@/lib/db/messaging-partner-inventory-pg'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({ title: 'Products', description: 'Shop products', path: `/site/${slug}/products`, noIndex: true })
  }
  return buildMetadata({
    title: `${shop.site.title} — Products`,
    description: shop.site.partnerDisplayName,
    path: `/site/${slug}/products`,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteProductsPage({ params }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()

  const page = await fetchPartnerInventoryActivePageWithCountFromPg(shop.partnerId, 0, 24)
  const initialProducts = (page?.rows ?? [])
    .map((row) => inventoryRowToShopProduct(shop.site.siteSlug, row))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

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
      <PartnerSiteShopCatalogClient
        siteSlug={shop.site.siteSlug}
        locale={shop.site.locale}
        initialProducts={initialProducts}
        initialTotal={page?.count ?? initialProducts.length}
      />
    </PartnerSiteShopShell>
  )
}
