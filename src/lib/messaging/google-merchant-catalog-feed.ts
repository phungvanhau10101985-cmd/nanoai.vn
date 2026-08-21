/**
 * TSV feed Google Merchant Center (scheduled fetch).
 * Cột khớp nguồn cấp dữ liệu 188 (`merchant_feed_tsv.TSV_COLUMNS`).
 * @see https://support.google.com/merchants/answer/7052112
 */

import {
  catalogFeedAgeGroup,
  catalogFeedBrand,
  catalogFeedColor,
  catalogFeedCustomLabels,
  catalogFeedGender,
  catalogFeedGoogleProductCategory,
  catalogFeedIdentifierExists,
  catalogFeedItemGroupId,
  catalogFeedMaterial,
  catalogFeedMpn,
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
  catalogFeedUtf8Tsv,
  formatCatalogFeedPrice,
  pickCatalogProductLandingLink,
  tsvEscapeCell,
  type CatalogFeedInventoryRow,
} from '@/lib/messaging/catalog-feed-shared'

export type { CatalogFeedBuildContext }

export const GOOGLE_MERCHANT_TSV_HEADERS = [
  'id',
  'title',
  'description',
  'link',
  'mobile_link',
  'image_link',
  'additional_image_link',
  'availability',
  'price',
  'custom_label_0',
  'custom_label_1',
  'custom_label_2',
  'custom_label_3',
  'custom_label_4',
  'sale_price',
  'sale_price_effective_date',
  'cost_of_goods_sold',
  'auto_pricing_min_price',
  'brand',
  'condition',
  'identifier_exists',
  'gtin',
  'mpn',
  'google_product_category',
  'product_type',
  'gender',
  'age_group',
  'color',
  'size',
  'material',
  'shipping_weight',
  'item_group_id',
  'video',
] as const

function rowToTsvLine(row: CatalogFeedInventoryRow, ctx: CatalogFeedBuildContext): string | null {
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
  const currency = catalogFeedCurrency(row)

  const cells = [
    catalogFeedItemId(row),
    catalogFeedTitle(row, 150),
    catalogFeedDescription(row, 5000),
    link,
    link,
    image,
    additional,
    catalogFeedIsInStock(row) ? 'in_stock' : 'out_of_stock',
    formatCatalogFeedPrice(priceNum, currency),
    c0,
    c1,
    c2,
    c3,
    c4,
    sale.sale,
    sale.effective,
    '',
    '',
    catalogFeedBrand(ctx, 70),
    'new',
    catalogFeedIdentifierExists(row),
    '',
    catalogFeedMpn(row),
    gcat,
    productType,
    catalogFeedGender(row, productType),
    catalogFeedAgeGroup(row, productType),
    catalogFeedColor(row),
    catalogFeedSize(row),
    catalogFeedMaterial(row),
    '',
    catalogFeedItemGroupId(row),
    catalogFeedVideoUrl(row),
  ].map(tsvEscapeCell)

  return cells.join('\t')
}

export function buildGoogleMerchantCatalogFeedTsv(
  rows: CatalogFeedInventoryRow[],
  ctx: CatalogFeedBuildContext | Omit<CatalogFeedBuildContext, 'industryKey' | 'productTypeByInventoryId'>
): Buffer {
  const full = emptyCatalogFeedBuildContext(ctx)
  const lines: string[] = [GOOGLE_MERCHANT_TSV_HEADERS.join('\t')]
  for (const row of rows) {
    const line = rowToTsvLine(row, full)
    if (line) lines.push(line)
  }
  return catalogFeedUtf8Tsv(lines)
}
