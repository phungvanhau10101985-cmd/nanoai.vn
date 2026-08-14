/**
 * CSV feed TikTok Ads catalog (scheduled URL).
 * @see https://ads.tiktok.com/help/article/catalog-management
 */

import {
  catalogFeedAdditionalImages,
  catalogFeedCurrency,
  catalogFeedDescription,
  catalogFeedImageUrl,
  catalogFeedIsInStock,
  catalogFeedItemId,
  catalogFeedPriceAmount,
  catalogFeedTitle,
  catalogFeedUtf8Csv,
  csvEscapeCell,
  formatCatalogFeedPrice,
  isAbsoluteHttpUrl,
  pickCatalogProductLandingLink,
  type CatalogFeedInventoryRow,
  type CatalogFeedShopLanding,
} from '@/lib/messaging/catalog-feed-shared'

export const TIKTOK_CATALOG_CSV_HEADERS = [
  'sku_id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'additional_image_link',
  'video_url',
] as const

function rowToCsvLine(
  row: CatalogFeedInventoryRow,
  ctx: {
    platformOrigin: string
    partnerSlug: string
    brand: string
    shop: CatalogFeedShopLanding | null
  }
): string | null {
  if (row.is_active === false) return null

  const image = catalogFeedImageUrl(row)
  if (!image) return null

  const link = pickCatalogProductLandingLink(row, ctx)
  if (!link) return null

  const priceNum = catalogFeedPriceAmount(row)
  if (priceNum == null) return null

  const video = (row.product_video_url ?? '').trim()
  const additional = catalogFeedAdditionalImages(row).join(',')

  const cells = [
    catalogFeedItemId(row),
    catalogFeedTitle(row, 255),
    catalogFeedDescription(row, 9990),
    catalogFeedIsInStock(row) ? 'in stock' : 'out of stock',
    'new',
    formatCatalogFeedPrice(priceNum, catalogFeedCurrency(row)),
    link,
    image,
    catalogFeedTitle({ name: ctx.brand || 'Shop' }, 100),
    additional,
    isAbsoluteHttpUrl(video) ? video : '',
  ].map(csvEscapeCell)

  return cells.join(',')
}

export function buildTiktokCatalogFeedCsv(
  rows: CatalogFeedInventoryRow[],
  ctx: {
    platformOrigin: string
    partnerSlug: string
    brand: string
    shop: CatalogFeedShopLanding | null
  }
): Buffer {
  const lines: string[] = [TIKTOK_CATALOG_CSV_HEADERS.join(',')]
  for (const row of rows) {
    const line = rowToCsvLine(row, ctx)
    if (line) lines.push(line)
  }
  return catalogFeedUtf8Csv(lines)
}
