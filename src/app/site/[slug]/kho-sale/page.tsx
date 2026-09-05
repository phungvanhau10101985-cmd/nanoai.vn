import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { inventoryCardRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteSaleOverlay, withPartnerSiteSale } from '@/lib/partner-website/promotions/partner-site-sale-attach'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteShopCatalogClient } from '@/components/partner-website/shop/partner-site-shop-catalog-client'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { liveVisualHomeChromeShellProps } from '@/lib/partner-website/shop/live-visual-home-chrome'
import { fetchPartnerInventoryShopCardPageFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  readVisualPreviewDevice,
  type PartnerSiteSearchParams,
} from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = { params: Promise<{ slug: string }>; searchParams?: PartnerSiteSearchParams }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({ title: 'Sale kho', description: 'Warehouse sale', path: `/site/${slug}/kho-sale`, noIndex: true })
  }
  const t = getPartnerSiteShopCopy(shop.site.locale)
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${t.khoSalePageTitle} — ${shop.site.title}`,
    description: t.khoSaleNavBlurb,
    path: '/kho-sale',
    image: shop.site.logoUrl,
    locale: shop.site.locale,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteKhoSalePage({ params, searchParams }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const device = await readVisualPreviewDevice(searchParams)
  const t = getPartnerSiteShopCopy(shop.site.locale)
  const page = await fetchPartnerInventoryShopCardPageFromPg(shop.partnerId, {
    offset: 0,
    limit: 24,
    warehouse: true,
    sort: 'newest',
  })
  const overlay = await loadPartnerSiteSaleOverlay(shop.partnerId).catch(() => null)
  const initialProducts = (page?.rows ?? [])
    .map((row) => {
      const mapped = inventoryCardRowToShopProduct(shop.site.siteSlug, row)
      return withPartnerSiteSale(mapped, overlay)
    })
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
      <p className="pw-shop-muted" style={{ margin: '0 0 8px' }}>
        {t.khoSaleNavBlurb}
      </p>
      <PartnerSiteShopCatalogClient
        siteSlug={shop.site.siteSlug}
        partnerSlug={shop.partnerSlug}
        locale={shop.site.locale}
        heading={t.khoSalePageTitle}
        apiQuery="warehouse=1"
        initialProducts={initialProducts}
        initialTotal={page?.count ?? initialProducts.length}
      />
    </PartnerSiteShopShell>
  )
}
