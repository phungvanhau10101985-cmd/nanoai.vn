import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteShopCatalogClient } from '@/components/partner-website/shop/partner-site-shop-catalog-client'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { liveVisualHomeChromeShellProps } from '@/lib/partner-website/shop/live-visual-home-chrome'
import { fetchPartnerInventoryActivePageWithCountFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import {
  maybePartnerSiteVisualPage,
  readVisualPreviewDevice,
  type PartnerSiteSearchParams,
} from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = { params: Promise<{ slug: string }>; searchParams?: PartnerSiteSearchParams }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({ title: 'Products', description: 'Shop products', path: `/site/${slug}/products`, noIndex: true })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Products`,
    description: shop.site.partnerDisplayName,
    path: '/products',
    image: shop.site.logoUrl,
    locale: shop.site.locale,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteProductsPage({ params, searchParams }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const device = await readVisualPreviewDevice(searchParams)
  const visual = await maybePartnerSiteVisualPage(
    shop.site,
    'products',
    device
  )
  if (visual) return visual

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
      footerJson={shop.site.footerJson}
      navJson={shop.site.navJson}
      activeNav="products"
      pageKind={PW_PAGE.listing}
      {...(await liveVisualHomeChromeShellProps(shop.site, device))}
    >
      <PartnerSiteShopCatalogClient
        siteSlug={shop.site.siteSlug}
        partnerSlug={shop.partnerSlug}
        locale={shop.site.locale}
        initialProducts={initialProducts}
        initialTotal={page?.count ?? initialProducts.length}
      />
    </PartnerSiteShopShell>
  )
}
