import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import {
  fetchDirectProductCountsByCategoryFromPg,
  fetchPartnerCategoriesFlatFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import {
  buildPartnerCategoryTree,
  flattenPartnerCategoryTree,
  prunePartnerCategoriesMissingAncestors,
  resolvePartnerCategoryDisplayName,
  rollupPartnerCategoryProductCounts,
} from '@/lib/partner-website/category/partner-category-types'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { isPartnerCategoryNavJunkNode } from '@/lib/partner-website/shop/partner-site-category-mega-menu'
import {
  partnerSiteCategoryPath,
  partnerSiteHomePath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { liveVisualHomeChromeShellProps } from '@/lib/partner-website/shop/live-visual-home-chrome'
import { resolveCategoryHubTileImages } from '@/lib/partner-website/shop/category-hub-images'
import { peekSiteVisitorAccountKey } from '@/lib/partner-website/shop/partner-site-personalization'
import {
  readVisualPreviewDevice,
  type PartnerSiteSearchParams,
} from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_EL, PW_PAGE, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  params: Promise<{ slug: string }>
  searchParams?: PartnerSiteSearchParams
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({ title: 'Categories', description: 'Categories', path: `/site/${slug}/c`, noIndex: true })
  }
  const t = getPartnerSiteShopCopy(shop.site.locale)
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${t.categoryHubTitle} — ${shop.site.title}`,
    description: t.categoryHubTitle,
    path: '/c',
    image: shop.site.logoUrl,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteCategoryHubPage({ params, searchParams }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const device = await readVisualPreviewDevice(searchParams)
  const t = getPartnerSiteShopCopy(shop.site.locale)
  const locale = shop.site.locale

  const [flat, counts] = await Promise.all([
    fetchPartnerCategoriesFlatFromPg(shop.partnerId, { activeOnly: true }),
    fetchDirectProductCountsByCategoryFromPg(shop.partnerId),
  ])
  const tree = buildPartnerCategoryTree(prunePartnerCategoriesMissingAncestors(flat ?? []))
  const rolled = rollupPartnerCategoryProductCounts(tree, counts ?? new Map())
  const rawTiles = flattenPartnerCategoryTree(tree)
    .filter((cat) => !isPartnerCategoryNavJunkNode(cat))
    .slice(0, 120)
  const accountKey = await peekSiteVisitorAccountKey()
  const images = await resolveCategoryHubTileImages({
    partnerId: shop.partnerId,
    accountKey,
    tree,
    tiles: rawTiles.map((cat) => ({ id: cat.id, imageUrl: cat.imageUrl })),
  })
  const imageById = new Map(images.map((t) => [t.id, t.imageUrl]))
  const tiles = rawTiles.map((cat) => ({
    ...cat,
    imageUrl: imageById.get(cat.id) || cat.imageUrl,
  }))

  return (
    <PartnerSiteShopShell
      siteSlug={shop.site.siteSlug}
      partnerSlug={shop.partnerSlug}
      title={shop.site.title}
      logoUrl={shop.site.logoUrl}
      theme={shop.site.theme}
      locale={locale}
      chatPath={shop.site.chatPath}
      tracking={partnerSiteTrackingFromPublicRow(shop.site)}
      footerJson={shop.site.footerJson}
      navJson={shop.site.navJson}
      activeNav="products"
      pageKind={PW_PAGE.listing}
      {...(await liveVisualHomeChromeShellProps(shop.site, device))}
    >
      <nav className="pw-shop-breadcrumb" data-pw-region={PW_REGION.breadcrumb} aria-label="Breadcrumb">
        <Link href={partnerSiteHomePath(shop.site.siteSlug)} data-pw-el={PW_EL.crumb}>{t.navHome}</Link>
        <span data-pw-el={PW_EL.crumb}>{' / '}{t.categoryHubTitle}</span>
      </nav>
      <h1 data-pw-el={PW_EL.sectionTitle}>{t.categoryHubTitle}</h1>
      {tiles.length === 0 ? (
        <p className="pw-shop-muted">{t.categoryHubEmpty}</p>
      ) : (
        <section data-pw-region={PW_REGION.categories}>
          <div className="pw-shop-category-hub">
            {tiles.map((cat) => {
              const name = resolvePartnerCategoryDisplayName(cat, locale)
              const count = rolled.get(cat.id) ?? 0
              return (
                <Link
                  key={cat.id}
                  href={partnerSiteCategoryPath(shop.site.siteSlug, cat.path)}
                  className="pw-shop-category-tile"
                  data-pw-el={PW_EL.card}
                >
                  {cat.imageUrl ? (
                    <img src={cat.imageUrl} alt={name} loading="lazy" data-pw-el={PW_EL.cardMedia} />
                  ) : (
                    <span className="pw-shop-category-tile-placeholder" data-pw-el={PW_EL.cardMedia} />
                  )}
                  <span className="pw-shop-category-tile-name" data-pw-el={PW_EL.cardName}>{name}</span>
                  {count > 0 ? <span className="pw-shop-category-tile-count">{count}</span> : null}
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </PartnerSiteShopShell>
  )
}
