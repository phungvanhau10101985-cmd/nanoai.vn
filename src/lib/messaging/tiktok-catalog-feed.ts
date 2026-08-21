/**
 * CSV feed TikTok Ads catalog (scheduled URL).
 * Cột khớp nguồn cấp dữ liệu 188 (`social_catalog_feed_tsv.TIKTOK_TSV_COLUMNS`).
 * @see https://ads.tiktok.com/help/article/catalog-management
 */

import {
  catalogFeedAgeGroup,
  catalogFeedBrand,
  catalogFeedColor,
  catalogFeedGender,
  catalogFeedGoogleProductCategory,
  catalogFeedItemGroupId,
  catalogFeedProductType,
  catalogFeedSalePriceCell,
  catalogFeedSize,
  catalogFeedVideoUrl,
  emptyCatalogFeedBuildContext,
  type CatalogFeedBuildContext,
} from '@/lib/messaging/catalog-feed-enrichment'
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
  pickCatalogProductLandingLink,
  type CatalogFeedInventoryRow,
} from '@/lib/messaging/catalog-feed-shared'

export type { CatalogFeedBuildContext }

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
  'google_product_category',
  'additional_image_link',
  'product_type',
  'color',
  'size',
  'sale_price',
  'sale_price_effective_date',
  'item_group_id',
  'gender',
  'age_group',
  'shipping_weight',
  'video_link',
  'video_url',
] as const

function rowToCsvLine(row: CatalogFeedInventoryRow, ctx: CatalogFeedBuildContext): string | null {
  if (row.is_active === false) return null

  const image = catalogFeedImageUrl(row)
  if (!image) return null

  const link = pickCatalogProductLandingLink(row, ctx)
  if (!link) return null

  const priceNum = catalogFeedPriceAmount(row)
  if (priceNum == null) return null

  const productType = catalogFeedProductType(row, ctx)
  const sale = catalogFeedSalePriceCell(row)
  const video = catalogFeedVideoUrl(row)
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
    catalogFeedBrand(ctx, 100),
    catalogFeedGoogleProductCategory(row, ctx),
    additional,
    productType,
    catalogFeedColor(row),
    catalogFeedSize(row),
    sale.sale,
    sale.effective,
    catalogFeedItemGroupId(row),
    catalogFeedGender(row, productType),
    catalogFeedAgeGroup(row, productType),
    '',
    video,
    video,
  ].map(csvEscapeCell)

  return cells.join(',')
}

export function buildTiktokCatalogFeedCsv(
  rows: CatalogFeedInventoryRow[],
  ctx: CatalogFeedBuildContext | Omit<CatalogFeedBuildContext, 'industryKey' | 'productTypeByInventoryId'>
): Buffer {
  const full = emptyCatalogFeedBuildContext(ctx)
  const lines: string[] = [TIKTOK_CATALOG_CSV_HEADERS.join(',')]
  for (const row of rows) {
    const line = rowToCsvLine(row, full)
    if (line) lines.push(line)
  }
  return catalogFeedUtf8Csv(lines)
}
