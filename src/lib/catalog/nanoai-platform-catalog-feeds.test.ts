import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildNanoAiFacebookCatalogFeedCsv,
  listNanoAiFacebookCatalogItems,
  NANOAI_FACEBOOK_CATALOG_HEADERS,
} from '@/lib/catalog/nanoai-facebook-catalog'
import { FACEBOOK_CATALOG_CSV_HEADERS } from '@/lib/messaging/facebook-catalog-feed'
import { GOOGLE_MERCHANT_TSV_HEADERS } from '@/lib/messaging/google-merchant-catalog-feed'
import { TIKTOK_CATALOG_CSV_HEADERS } from '@/lib/messaging/tiktok-catalog-feed'
import {
  NANOAI_GOOGLE_MERCHANT_HEADERS,
  NANOAI_GOOGLE_PRODUCT_CATEGORY,
  NANOAI_GOOGLE_SHIPPING,
  NANOAI_TIKTOK_CATALOG_HEADERS,
  buildNanoAiGoogleMerchantFeedTsv,
  buildNanoAiTikTokCatalogFeedCsv,
} from '@/lib/catalog/nanoai-platform-catalog-feeds'
import { toNanoAiFeatureCatalogIdFromHref } from '@/lib/catalog/nanoai-feature-catalog-id'
import { AI_TOOLS } from '@/lib/nav-config'
import { WEDDING_COMMERCE_CONTENT_ID } from '@/lib/wedding/wedding-commerce-events'

const ORIGIN = 'https://nanoai.vn'

function parseTsv(buf: Buffer): string[][] {
  return buf
    .toString('utf8')
    .trim()
    .split('\n')
    .map((line) => line.split('\t'))
}

function parseCsv(buf: Buffer): string[][] {
  const text = buf.toString('utf8').replace(/^\uFEFF/, '')
  return text
    .trim()
    .split(/\r\n/)
    .map((line) => line.split(','))
}

describe('nanoai platform catalog feeds', () => {
  it('google merchant feed has shopping columns and the same ids as facebook', () => {
    const items = listNanoAiFacebookCatalogItems()
    const rows = parseTsv(buildNanoAiGoogleMerchantFeedTsv(ORIGIN))
    assert.deepEqual(rows[0], [...NANOAI_GOOGLE_MERCHANT_HEADERS])
    assert.equal(rows.length, items.length + 1)

    const idIdx = rows[0].indexOf('id')
    const facebook = parseCsv(buildNanoAiFacebookCatalogFeedCsv(ORIGIN))
    const facebookIds = facebook.slice(1).map((row) => row[0])
    const googleIds = rows.slice(1).map((row) => row[idIdx])
    assert.deepEqual(googleIds, facebookIds)

    for (const row of rows.slice(1)) {
      const cell = (name: string) => row[rows[0].indexOf(name)]
      assert.ok(cell('id').length > 0 && cell('id').length <= 50)
      assert.match(cell('id'), /^[A-Za-z0-9_-]+$/)
      assert.ok(cell('title').length > 0 && cell('title').length <= 150)
      assert.ok(cell('description').length > 0)
      assert.match(cell('link'), /^https:\/\/nanoai\.vn\//)
      assert.match(cell('image_link'), /^https:\/\//)
      assert.equal(cell('availability'), 'in_stock')
      assert.match(cell('price'), /^\d+\.00 VND$/)
      assert.notEqual(cell('price'), '0.00 VND')
      assert.equal(cell('brand'), 'NanoAI')
      assert.equal(cell('condition'), 'new')
      assert.equal(cell('identifier_exists'), 'no')
      assert.equal(cell('google_product_category'), NANOAI_GOOGLE_PRODUCT_CATEGORY)
      assert.ok(cell('product_type').startsWith('NanoAI'))
      assert.equal(cell('shipping'), NANOAI_GOOGLE_SHIPPING)
      assert.equal(cell('adult'), 'no')
      assert.equal(cell('link'), cell('mobile_link'))
    }
  })

  it('wedding, student plan, and wallet share one id across facebook, tiktok, and google', () => {
    const google = parseTsv(buildNanoAiGoogleMerchantFeedTsv(ORIGIN))
    const tiktok = parseCsv(buildNanoAiTikTokCatalogFeedCsv(ORIGIN))
    const facebook = parseCsv(buildNanoAiFacebookCatalogFeedCsv(ORIGIN))
    assert.deepEqual(tiktok[0], [...NANOAI_TIKTOK_CATALOG_HEADERS])

    const ids = (table: string[][], col: number) => table.slice(1).map((row) => row[col])
    const facebookIds = ids(facebook, 0)
    const googleIds = ids(google, 0)
    const tiktokIds = ids(tiktok, 0)
    assert.deepEqual(tiktokIds, facebookIds)
    assert.deepEqual(googleIds, facebookIds)
    assert.ok(facebookIds.includes(WEDDING_COMMERCE_CONTENT_ID))
    assert.ok(facebookIds.includes('feature_goi_hoc_sinh'))
    assert.ok(facebookIds.includes('feature_wallet_topup'))

    const wedding = google.find((row) => row[0] === WEDDING_COMMERCE_CONTENT_ID)
    assert.ok(wedding)
    assert.equal(wedding[google[0].indexOf('price')], '149000.00 VND')
    assert.equal(wedding[google[0].indexOf('link')], 'https://nanoai.vn/tao-thiep-moi-cuoi-ai')

    assert.deepEqual([...NANOAI_FACEBOOK_CATALOG_HEADERS], [...FACEBOOK_CATALOG_CSV_HEADERS])
    assert.deepEqual([...NANOAI_TIKTOK_CATALOG_HEADERS], [...TIKTOK_CATALOG_CSV_HEADERS])
    assert.deepEqual([...NANOAI_GOOGLE_MERCHANT_HEADERS], [...GOOGLE_MERCHANT_TSV_HEADERS, 'shipping', 'adult'])
    const facebookHeader = buildNanoAiFacebookCatalogFeedCsv(ORIGIN).toString('utf8').replace(/^\uFEFF/, '').split(/\r\n/)[0]
    assert.equal(facebookHeader, NANOAI_FACEBOOK_CATALOG_HEADERS.join(','))

    const curriculum = google.find((row) => row[0] === 'feature_tao_giao_trinh')
    assert.ok(curriculum)
    assert.equal(curriculum.length, google[0].length)
    const g = (name: string) => curriculum[google[0].indexOf(name)]
    assert.equal(g('price'), '6000.00 VND')
    assert.equal(g('availability'), 'in_stock')
    assert.equal(g('identifier_exists'), 'no')
    assert.equal(g('gtin'), '')
    assert.equal(g('mpn'), '')
    assert.equal(g('google_product_category'), NANOAI_GOOGLE_PRODUCT_CATEGORY)
    assert.equal(g('shipping'), NANOAI_GOOGLE_SHIPPING)
    assert.equal(g('adult'), 'no')
    assert.equal(g('custom_label_0'), 'under_50k')
    assert.equal(g('custom_label_2'), 'software')
    assert.match(g('description'), /YouTube/)
    assert.match(g('description'), /PhET/)
    assert.match(g('image_link'), /^https:\/\//)
  })

  it('every AI_TOOLS href is already in the three feeds', () => {
    const ids = new Set(listNanoAiFacebookCatalogItems().map((item) => item.id))
    const hrefs = AI_TOOLS.map((tool) => tool.href).filter(Boolean)
    assert.ok(hrefs.length > 0)
    for (const href of hrefs) {
      const id = toNanoAiFeatureCatalogIdFromHref(href)
      assert.ok(ids.has(id), href)
      assert.ok(id.length <= 50, id)
    }
  })
})
