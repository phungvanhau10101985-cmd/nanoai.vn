// Smoke test (S0.11): feed Google Merchant Center (TSV) + TikTok Catalog (CSV).
// Chạy: npx tsx scripts/test-s0_11-ads-catalog-feeds.ts
import { buildGoogleMerchantCatalogFeedTsv, GOOGLE_MERCHANT_TSV_HEADERS } from '../src/lib/messaging/google-merchant-catalog-feed'
import { buildTiktokCatalogFeedCsv, TIKTOK_CATALOG_CSV_HEADERS } from '../src/lib/messaging/tiktok-catalog-feed'
import {
  catalogFeedItemId,
  pickCatalogProductLandingLink,
  type CatalogFeedInventoryRow,
} from '../src/lib/messaging/catalog-feed-shared'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

function row(partial: Partial<CatalogFeedInventoryRow> & Pick<CatalogFeedInventoryRow, 'id'>): CatalogFeedInventoryRow {
  return {
    partner_id: 'p1',
    sort_order: 0,
    sku: 'SKU-1',
    name: 'Túi đeo chéo',
    description: 'Túi da bò',
    stock_note: '',
    stock_qty: 3,
    price_hint: '1.299.000 ₫',
    image_url: 'https://cdn.example/main.jpg',
    product_url: '',
    product_video_url: '',
    consult_note: '',
    remarketing_id: 'rm-88',
    material_note: '',
    material_detail_image_url: 'https://cdn.example/detail.jpg',
    real_use_image_url: '',
    real_use_image_url_2: '',
    is_active: true,
    price_amount: 1299000,
    price_currency: 'VND',
    sale_price_amount: 999000,
    sale_starts_at: null,
    sale_ends_at: null,
    image_embedding_json: null,
    image_embedding_vec: null,
    image_embedding_model: null,
    image_embedding_dims: null,
    image_embedding_fingerprint: null,
    image_embedding_updated_at: null,
    image_embedding_error: null,
    text_embedding_json: null,
    text_embedding_vec: null,
    text_embedding_model: null,
    text_embedding_dims: null,
    text_embedding_fingerprint: null,
    text_embedding_updated_at: null,
    text_embedding_error: null,
    vision_catalog_checksum: null,
    vision_catalog_synced_at: null,
    vision_catalog_excluded: false,
    consult_link_opening_text: null,
    consult_link_opening_input_fingerprint: null,
    colors_json: null,
    sizes_json: null,
    gallery_urls: [],
    detail_image_urls: [],
    product_studio_meta: null,
    origin: null,
    product_studio_job_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

const shop = {
  siteSlug: '188-com-vn-rl56',
  origin: 'https://shop.example',
  customDomain: true,
}

function main() {
  assert(catalogFeedItemId(row({ id: 'inv-1', remarketing_id: 'rm-88' })) === 'rm-88', 'id phải lấy remarketing_id')
  assert(catalogFeedItemId(row({ id: 'inv-1', remarketing_id: '' })) === 'inv-1', 'id fallback inventory.id')
  console.log('OK catalog id: remarketing_id || inventory.id')

  const link = pickCatalogProductLandingLink(row({ id: '00073cac-aaaa-bbbb-cccc-ddddeeeeffff' }), {
    platformOrigin: 'https://nanoai.vn',
    partnerSlug: '188-partner',
    shop,
  })
  assert(
    link === 'https://shop.example/products/tui-deo-cheo-00073cac',
    `link PDP shop sai: ${link}`
  )
  console.log('OK landing link: PDP shop đã publish (custom domain)')

  const gmc = buildGoogleMerchantCatalogFeedTsv(
    [
      row({ id: 'inv-1' }),
      row({ id: 'inv-skip', is_active: false }),
      row({ id: 'inv-no-image', image_url: '' }),
    ],
    { platformOrigin: 'https://nanoai.vn', partnerSlug: '188-partner', brand: '188', shop }
  )
  const gmcText = gmc.toString('utf8')
  const gmcLines = gmcText.trim().split('\n')
  assert(gmcLines[0] === GOOGLE_MERCHANT_TSV_HEADERS.join('\t'), 'header TSV Google sai')
  assert(gmcLines.length === 2, `Google phải 1 dòng SP, thực tế ${gmcLines.length - 1}`)
  assert(gmcText.includes('rm-88'), 'Google thiếu catalog id')
  assert(gmcText.includes('in_stock'), 'Google thiếu availability')
  assert(gmcText.includes('1299000 VND'), 'Google thiếu price')
  assert(gmcText.includes('999000 VND'), 'Google thiếu sale_price')
  assert(gmcText.includes('FALSE'), 'Google thiếu identifier_exists')
  assert(!gmcText.includes('inv-skip'), 'Google không được gồm SP tắt')
  console.log('OK Google Merchant TSV: cột bắt buộc + sale_price + bỏ SP không hợp lệ')

  const tt = buildTiktokCatalogFeedCsv([row({ id: 'inv-1', stock_qty: 0 })], {
    platformOrigin: 'https://nanoai.vn',
    partnerSlug: '188-partner',
    brand: '188',
    shop,
  })
  const ttText = tt.toString('utf8').replace(/^\ufeff/, '')
  const ttLines = ttText.trim().split('\r\n')
  assert(ttLines[0] === TIKTOK_CATALOG_CSV_HEADERS.join(','), 'header CSV TikTok sai')
  assert(ttLines[1]?.includes('rm-88'), 'TikTok sku_id phải khớp catalog id')
  assert(ttLines[1]?.includes('out of stock'), 'TikTok phải out of stock khi qty=0')
  assert(ttLines[1]?.includes('1299000 VND'), 'TikTok thiếu price')
  console.log('OK TikTok CSV: sku_id khớp + availability')

  console.log('\n✅ ALL S0.11 (Google Merchant + TikTok catalog feeds) CHECKS PASSED')
}

main()
