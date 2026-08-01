import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchPartnerInventoryActivePageWithCountFromPg, fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { buildMetadata } from '@/lib/seo'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteShopProductClient } from '@/components/partner-website/shop/partner-site-shop-product-client'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'

type Props = { params: Promise<{ slug: string; inventoryId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, inventoryId } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({ title: 'Product', description: 'Product', path: `/site/${slug}/products/${inventoryId}`, noIndex: true })
  }
  const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(shop.partnerId, inventoryId)
  const product = row ? inventoryRowToShopProduct(shop.site.siteSlug, row) : null
  return buildMetadata({
    title: product?.name ?? shop.site.title,
    description: product?.description || shop.site.partnerDisplayName,
    path: `/site/${slug}/products/${inventoryId}`,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteProductDetailPage({ params }: Props) {
  const { slug, inventoryId } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()

  const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(shop.partnerId, inventoryId)
  const product = row ? inventoryRowToShopProduct(shop.site.siteSlug, row) : null
  if (!product) notFound()

  const relatedPage = await fetchPartnerInventoryActivePageWithCountFromPg(shop.partnerId, 0, 8)
  const relatedProducts = (relatedPage?.rows ?? [])
    .filter((r) => r.id !== inventoryId)
    .map((r) => inventoryRowToShopProduct(shop.site.siteSlug, r))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 4)

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
      <PartnerSiteShopProductClient
        siteSlug={shop.site.siteSlug}
        partnerSlug={shop.partnerSlug}
        locale={shop.site.locale}
        product={product}
        relatedProducts={relatedProducts}
      />
    </PartnerSiteShopShell>
  )
}
