import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteShopInfoView } from '@/components/partner-website/shop/partner-site-shop-info-view'
import { PartnerSiteShopCatalogClient } from '@/components/partner-website/shop/partner-site-shop-catalog-client'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import {
  getPartnerSiteInfoPage,
  type PartnerSiteInfoPageKey,
} from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { fetchPartnerInventoryActivePageWithCountFromPg } from '@/lib/db/messaging-partner-inventory-pg'

export async function buildPartnerSiteInfoMetadata(
  slug: string,
  pageKey: PartnerSiteInfoPageKey
): Promise<Metadata> {
  const shop = await loadPartnerSiteShopContext(slug)
  const locale = shop?.site.locale ?? 'vi'
  const block = getPartnerSiteInfoPage(pageKey, locale)
  return buildMetadata({
    title: `${shop?.site.title || 'Shop'} — ${block.title}`,
    description: block.paragraphs[0] || block.title,
    path: `/site/${slug}/${pageKey}`,
  })
}

export async function PartnerSiteInfoPageScreen({
  slug,
  pageKey,
}: {
  slug: string
  pageKey: PartnerSiteInfoPageKey
}) {
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()

  const activeNav =
    pageKey === 'sale' ? 'sale' : pageKey === 'about' || pageKey === 'contact' ? 'home' : 'products'

  let saleCatalog: React.ReactNode = null
  if (pageKey === 'sale') {
    const page = await fetchPartnerInventoryActivePageWithCountFromPg(shop.partnerId, 0, 24)
    const initialProducts = (page?.rows ?? [])
      .map((row) => inventoryRowToShopProduct(shop.site.siteSlug, row))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
    saleCatalog = (
      <div style={{ marginTop: 28 }}>
        <PartnerSiteShopCatalogClient
          siteSlug={shop.site.siteSlug}
          locale={shop.site.locale}
          initialProducts={initialProducts}
          initialTotal={page?.count ?? initialProducts.length}
        />
      </div>
    )
  }

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
      activeNav={activeNav}
    >
      <PartnerSiteShopInfoView
        siteSlug={shop.site.siteSlug}
        locale={shop.site.locale}
        pageKey={pageKey}
      />
      {saleCatalog}
    </PartnerSiteShopShell>
  )
}
