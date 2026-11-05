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
  NANOAI_TIKTOK_CATALOG_HEADERS,
  buildNanoAiGoogleMerchantFeedTsv,
  buildNanoAiTikTokCatalogFeedCsv,
  isNanoAiGoogleShoppingEligible,
  listNanoAiGoogleShoppingCatalogItems,
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
  it('google merchant feed keeps shopping headers and lists no services', () => {
    const items = listNanoAiFacebookCatalogItems()
    assert.ok(items.length > 0)
    for (const item of items) {
      assert.equal(isNanoAiGoogleShoppingEligible(item), false, item.id)
    }
    assert.deepEqual(listNanoAiGoogleShoppingCatalogItems(), [])

    const rows = parseTsv(buildNanoAiGoogleMerchantFeedTsv(ORIGIN))
    assert.deepEqual(rows[0], [...NANOAI_GOOGLE_MERCHANT_HEADERS])
    assert.equal(rows.length, 1)
    assert.deepEqual([...NANOAI_GOOGLE_MERCHANT_HEADERS], [...GOOGLE_MERCHANT_TSV_HEADERS, 'shipping', 'adult'])
  })

  it('wedding, student plan, and wallet share one id on facebook and tiktok, not google shopping', () => {
    const google = parseTsv(buildNanoAiGoogleMerchantFeedTsv(ORIGIN))
    const tiktok = parseCsv(buildNanoAiTikTokCatalogFeedCsv(ORIGIN))
    const facebook = parseCsv(buildNanoAiFacebookCatalogFeedCsv(ORIGIN))
    assert.deepEqual(tiktok[0], [...NANOAI_TIKTOK_CATALOG_HEADERS])

    const ids = (table: string[][], col: number) => table.slice(1).map((row) => row[col])
    const facebookIds = ids(facebook, 0)
    const googleIds = ids(google, 0)
    const tiktokIds = ids(tiktok, 0)
    assert.deepEqual(tiktokIds, facebookIds)
    assert.deepEqual(googleIds, [])
    assert.ok(facebookIds.includes(WEDDING_COMMERCE_CONTENT_ID))
    assert.ok(facebookIds.includes('feature_goi_hoc_sinh'))
    assert.ok(facebookIds.includes('feature_wallet_topup'))

    const facebookHeader = buildNanoAiFacebookCatalogFeedCsv(ORIGIN).toString('utf8').replace(/^\uFEFF/, '').split(/\r\n/)[0]
    assert.equal(facebookHeader, NANOAI_FACEBOOK_CATALOG_HEADERS.join(','))
    assert.deepEqual([...NANOAI_FACEBOOK_CATALOG_HEADERS], [...FACEBOOK_CATALOG_CSV_HEADERS])
    assert.deepEqual([...NANOAI_TIKTOK_CATALOG_HEADERS], [...TIKTOK_CATALOG_CSV_HEADERS])

    const curriculum = listNanoAiFacebookCatalogItems().find((item) => item.id === 'feature_tao_giao_trinh')
    assert.ok(curriculum)
    assert.equal(curriculum.priceVnd, 6000)
    assert.match(curriculum.description, /YouTube/)
    assert.match(curriculum.description, /PhET/)
    assert.equal(isNanoAiGoogleShoppingEligible(curriculum), false)
  })

  it('every AI_TOOLS href is in the facebook and tiktok catalogs, not google shopping', () => {
    const ids = new Set(listNanoAiFacebookCatalogItems().map((item) => item.id))
    const hrefs = AI_TOOLS.map((tool) => tool.href).filter(Boolean)
    assert.ok(hrefs.length > 0)
    const googleIds = new Set(
      parseTsv(buildNanoAiGoogleMerchantFeedTsv(ORIGIN))
        .slice(1)
        .map((row) => row[0]),
    )
    for (const href of hrefs) {
      const id = toNanoAiFeatureCatalogIdFromHref(href)
      assert.ok(ids.has(id), href)
      assert.ok(id.length <= 50, id)
      assert.equal(googleIds.has(id), false, href)
    }
  })
})
