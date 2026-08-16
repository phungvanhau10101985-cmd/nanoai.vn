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
import { fetchPublishedPartnerStaticPageBySlugFromPg } from '@/lib/db/messaging-partner-static-pages-pg'
import { splitStaticPageContentToParagraphs } from '@/lib/partner-website/pages/partner-static-page-types'
import { maybePartnerSiteVisualPage } from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { infoPageKeyToVisualPageKey } from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'

/**
 * W3.3 — merchant có thể ghi đè title/content/SEO của 8 trang có sẵn qua CMS (W3.4). Không có
 * override (hoặc `is_published=false`) → giữ nguyên hành vi hardcode cũ, 100% tương thích ngược.
 */
export async function buildPartnerSiteInfoMetadata(
  slug: string,
  pageKey: PartnerSiteInfoPageKey
): Promise<Metadata> {
  const shop = await loadPartnerSiteShopContext(slug)
  const locale = shop?.site.locale ?? 'vi'
  const block = getPartnerSiteInfoPage(pageKey, locale)
  const override = shop ? await fetchPublishedPartnerStaticPageBySlugFromPg(shop.partnerId, pageKey) : null

  if (override) {
    const firstParagraph = splitStaticPageContentToParagraphs(override.content)[0] ?? ''
    return buildMetadata({
      title: override.seoTitle || `${shop?.site.title || 'Shop'} — ${override.title}`,
      description: override.seoDescription || firstParagraph || override.title,
      path: `/site/${slug}/${pageKey}`,
      noIndex: !override.seoIndex,
    })
  }

  return buildMetadata({
    title: `${shop?.site.title || 'Shop'} — ${block.title}`,
    description: block.paragraphs[0] || block.title,
    path: `/site/${slug}/${pageKey}`,
    // thank-you là trang sau checkout — không index.
    noIndex: pageKey === 'thank-you',
  })
}

export async function PartnerSiteInfoPageScreen({
  slug,
  pageKey,
  orderId = null,
}: {
  slug: string
  pageKey: PartnerSiteInfoPageKey
  /** W3.2 — thank-you sau checkout (`?order=`). */
  orderId?: string | null
}) {
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()

  const visual = maybePartnerSiteVisualPage(shop.site, infoPageKeyToVisualPageKey(pageKey))
  if (visual) return visual

  const override = await fetchPublishedPartnerStaticPageBySlugFromPg(shop.partnerId, pageKey)

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
          partnerSlug={shop.partnerSlug}
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
      footerJson={shop.site.footerJson}
      navJson={shop.site.navJson}
      pageKind={pageKey === 'sale' || pageKey === 'lookbook' ? PW_PAGE.listing : PW_PAGE.info}
    >
      <PartnerSiteShopInfoView
        siteSlug={shop.site.siteSlug}
        locale={shop.site.locale}
        pageKey={pageKey}
        orderId={pageKey === 'thank-you' ? orderId : null}
        override={override ? { title: override.title, paragraphs: splitStaticPageContentToParagraphs(override.content) } : null}
      />
      {saleCatalog}
    </PartnerSiteShopShell>
  )
}
