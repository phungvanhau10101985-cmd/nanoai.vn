/**
 * CSV feed tương thích Meta Commerce Manager (danh mục sản phẩm / Facebook).
 * Cột khớp nguồn cấp dữ liệu 188 (`social_catalog_feed_tsv.META_TSV_COLUMNS`).
 * @see https://developers.facebook.com/docs/commerce-platform/catalog/fields
 */

import {
  catalogFeedAgeGroup,
  catalogFeedBrand,
  catalogFeedColor,
  catalogFeedCustomLabels,
  catalogFeedFbProductCategory,
  catalogFeedGender,
  catalogFeedGoogleProductCategory,
  catalogFeedInternalLabel,
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
  parseVndIntegerFromPriceHint,
  pickCatalogProductLandingLink,
  type CatalogFeedInventoryRow,
} from '@/lib/messaging/catalog-feed-shared'

export type { CatalogFeedBuildContext }

/** Cột Meta Commerce — đủ trường như feed 188 (CSV, Meta chấp nhận CSV/TSV). */
export const FACEBOOK_CATALOG_CSV_HEADERS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'additional_image_link',
  'google_product_category',
  'fb_product_category',
  'product_type',
  'color',
  'size',
  'sale_price',
  'sale_price_effective_date',
  'item_group_id',
  'gender',
  'age_group',
  'custom_label_0',
  'custom_label_1',
  'custom_label_2',
  'custom_label_3',
  'custom_label_4',
  'internal_label',
  'video_url',
  'shipping_weight',
] as const

export { parseVndIntegerFromPriceHint }

function rowToCsvLine(row: CatalogFeedInventoryRow, ctx: CatalogFeedBuildContext): string | null {
  if (row.is_active === false) return null

  const image = catalogFeedImageUrl(row)
  if (!image) return null

  const link = pickCatalogProductLandingLink(row, ctx)
  if (!link) return null

  const priceNum = catalogFeedPriceAmount(row)
  if (priceNum == null) return null

  const productType = catalogFeedProductType(row, ctx)
  const gcat = catalogFeedGoogleProductCategory(row, ctx)
  const sale = catalogFeedSalePriceCell(row)
  const [c0, c1, c2, c3, c4] = catalogFeedCustomLabels(row, productType)
  const additional = catalogFeedAdditionalImages(row).join(',')

  const cells = [
    catalogFeedItemId(row),
    catalogFeedTitle(row, 200),
    catalogFeedDescription(row, 9990),
    catalogFeedIsInStock(row) ? 'in stock' : 'out of stock',
    'new',
    formatCatalogFeedPrice(priceNum, catalogFeedCurrency(row)),
    link,
    image,
    catalogFeedBrand(ctx, 100),
    additional,
    gcat,
    catalogFeedFbProductCategory(ctx, gcat),
    productType,
    catalogFeedColor(row),
    catalogFeedSize(row),
    sale.sale,
    sale.effective,
    catalogFeedItemGroupId(row),
    catalogFeedGender(row, productType),
    catalogFeedAgeGroup(row, productType),
    c0,
    c1,
    c2,
    c3,
    c4,
    catalogFeedInternalLabel(row, productType),
    catalogFeedVideoUrl(row),
    '',
  ].map(csvEscapeCell)

  return cells.join(',')
}

/**
 * UTF-8 BOM giúp Excel/Google Trang tính nhận UTF-8 khi tải file.
 */
export function buildFacebookCatalogFeedCsv(
  rows: CatalogFeedInventoryRow[],
  ctx: CatalogFeedBuildContext | Omit<CatalogFeedBuildContext, 'industryKey' | 'productTypeByInventoryId'>
): Buffer {
  const full = emptyCatalogFeedBuildContext(ctx)
  const lines: string[] = [FACEBOOK_CATALOG_CSV_HEADERS.join(',')]
  for (const row of rows) {
    const line = rowToCsvLine(row, full)
    if (line) lines.push(line)
  }
  return catalogFeedUtf8Csv(lines)
}
