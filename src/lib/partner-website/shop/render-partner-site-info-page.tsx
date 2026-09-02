import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo-json-ld'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteShopInfoView } from '@/components/partner-website/shop/partner-site-shop-info-view'
import { PartnerSiteShopCatalogClient } from '@/components/partner-website/shop/partner-site-shop-catalog-client'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { liveVisualHomeChromeShellProps } from '@/lib/partner-website/shop/live-visual-home-chrome'
import {
  getPartnerSiteInfoPage,
  type PartnerSiteInfoPageKey,
} from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { fetchPartnerInventoryActivePageWithCountFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchPublishedPartnerStaticPageBySlugFromPg } from '@/lib/db/messaging-partner-static-pages-pg'
import { splitStaticPageContentToParagraphs } from '@/lib/partner-website/pages/partner-static-page-types'
import {
  buildPartnerInfoPageArticleJsonLd,
  buildPartnerInfoPageBreadcrumbJsonLd,
} from '@/lib/partner-website/pages/partner-info-page-advanced-seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { resolvePartnerSiteAbsoluteUrl } from '@/lib/partner-website/shop/partner-site-absolute-url'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  maybePartnerSiteVisualPage,
  readVisualPreviewDevice,
} from '@/components/partner-website/shop/partner-site-visual-html-screen'
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
  const siteName = shop?.site.title || 'Shop'
  const noIndex = override ? !override.seoIndex : pageKey === 'thank-you'
  const title = override
    ? override.seoTitle || `${siteName} — ${override.title}`
    : `${siteName} — ${block.title}`
  const description = override
    ? override.seoDescription ||
      splitStaticPageContentToParagraphs(override.content)[0] ||
      override.title
    : block.paragraphs[0] || block.title

  return buildPartnerSiteMetadata({
    siteSlug: slug,
    path: `/${pageKey}`,
    title,
    description,
    siteName,
    noIndex,
    image: shop?.site.logoUrl || null,
    locale: locale === 'vi' ? 'vi_VN' : locale,
    type: 'article',
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
  const device = await readVisualPreviewDevice()
  const override = await fetchPublishedPartnerStaticPageBySlugFromPg(shop.partnerId, pageKey)

  const visual = maybePartnerSiteVisualPage(
    shop.site,
    infoPageKeyToVisualPageKey(pageKey),
    device,
    override
      ? {
          datePublished: override.createdAt || null,
          dateModified: override.updatedAt || null,
          noIndex: !override.seoIndex,
        }
      : { noIndex: pageKey === 'thank-you' }
  )
  if (visual) return visual

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

  const block = getPartnerSiteInfoPage(pageKey, shop.site.locale)
  const headline = override?.seoTitle || override?.title || block.title
  const description =
    override?.seoDescription ||
    (override ? splitStaticPageContentToParagraphs(override.content)[0] : '') ||
    block.paragraphs[0] ||
    block.title
  const pageUrl = resolvePartnerSiteAbsoluteUrl(shop.site.siteSlug, `/${pageKey}`)
  const homeUrl = resolvePartnerSiteAbsoluteUrl(shop.site.siteSlug, '/')
  const t = getPartnerSiteShopCopy(shop.site.locale)
  const articleLd = buildPartnerInfoPageArticleJsonLd({
    pageUrl,
    homeUrl,
    siteName: shop.site.title,
    logoUrl: shop.site.logoUrl,
    locale: shop.site.locale,
    homeLabel: t.navHome,
    datePublished: override?.createdAt || null,
    dateModified: override?.updatedAt || null,
    headline,
    description,
  })
  const breadcrumbLd = buildPartnerInfoPageBreadcrumbJsonLd({
    homeUrl,
    homeLabel: t.navHome,
    pageUrl,
    pageName: override?.title || block.title,
  })

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
      {...(await liveVisualHomeChromeShellProps(shop.site, device))}
    >
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />
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
