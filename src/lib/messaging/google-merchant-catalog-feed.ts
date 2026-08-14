/**
 * TSV feed Google Merchant Center (scheduled fetch).
 * @see https://support.google.com/merchants/answer/7052112
 */

import {
  catalogFeedAdditionalImages,
  catalogFeedCurrency,
  catalogFeedDescription,
  catalogFeedImageUrl,
  catalogFeedIsInStock,
  catalogFeedItemId,
  catalogFeedPriceAmount,
  catalogFeedSalePriceAmount,
  catalogFeedSku,
  catalogFeedTitle,
  catalogFeedUtf8Tsv,
  formatCatalogFeedPrice,
  pickCatalogProductLandingLink,
  tsvEscapeCell,
  type CatalogFeedInventoryRow,
  type CatalogFeedShopLanding,
} from '@/lib/messaging/catalog-feed-shared'

export const GOOGLE_MERCHANT_TSV_HEADERS = [
  'id',
  'title',
  'description',
  'link',
  'image_link',
  'additional_image_link',
  'availability',
  'price',
  'sale_price',
  'condition',
  'brand',
  'mpn',
  'identifier_exists',
] as const

function rowToTsvLine(
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

  const currency = catalogFeedCurrency(row)
  const sale = catalogFeedSalePriceAmount(row, priceNum)
  const additional = catalogFeedAdditionalImages(row).join(',')

  const cells = [
    catalogFeedItemId(row),
    catalogFeedTitle(row, 150),
    catalogFeedDescription(row, 5000),
    link,
    image,
    additional,
    catalogFeedIsInStock(row) ? 'in_stock' : 'out_of_stock',
    formatCatalogFeedPrice(priceNum, currency),
    sale != null ? formatCatalogFeedPrice(sale, currency) : '',
    'new',
    catalogFeedTitle({ name: ctx.brand || 'Shop' }, 70),
    catalogFeedSku(row),
    'FALSE',
  ].map(tsvEscapeCell)

  return cells.join('\t')
}

export function buildGoogleMerchantCatalogFeedTsv(
  rows: CatalogFeedInventoryRow[],
  ctx: {
    platformOrigin: string
    partnerSlug: string
    brand: string
    shop: CatalogFeedShopLanding | null
  }
): Buffer {
  const lines: string[] = [GOOGLE_MERCHANT_TSV_HEADERS.join('\t')]
  for (const row of rows) {
    const line = rowToTsvLine(row, ctx)
    if (line) lines.push(line)
  }
  return catalogFeedUtf8Tsv(lines)
}
