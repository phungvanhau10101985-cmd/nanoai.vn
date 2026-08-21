// Smoke test (S0.11): feed Google Merchant Center (TSV) + TikTok Catalog (CSV) + Meta (CSV).
// Chạy: npx tsx scripts/test-s0_11-ads-catalog-feeds.ts
import { buildFacebookCatalogFeedCsv, FACEBOOK_CATALOG_CSV_HEADERS } from '../src/lib/messaging/facebook-catalog-feed'
import { buildGoogleMerchantCatalogFeedTsv, GOOGLE_MERCHANT_TSV_HEADERS } from '../src/lib/messaging/google-merchant-catalog-feed'
import { buildTiktokCatalogFeedCsv, TIKTOK_CATALOG_CSV_HEADERS } from '../src/lib/messaging/tiktok-catalog-feed'
import { catalogFeedGender } from '../src/lib/messaging/catalog-feed-enrichment'
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
    name: 'Túi đeo chéo nam',
    description: 'Túi da bò',
    stock_note: '',
    stock_qty: 3,
    price_hint: '1.299.000 ₫',
    image_url: 'https://cdn.example/main.jpg',
    product_url: '',
    product_video_url: 'https://cdn.example/clip.mp4',
    consult_note: '',
    remarketing_id: 'rm-88',
    material_note: 'Da bò thật',
    material_detail_image_url: 'https://cdn.example/detail.jpg',
    real_use_image_url: '',
    real_use_image_url_2: '',
    is_active: true,
    price_amount: 1299000,
    price_currency: 'VND',
    sale_price_amount: 999000,
    sale_starts_at: '2026-08-01T00:00:00.000Z',
    sale_ends_at: '2026-08-31T00:00:00.000Z',
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
    colors_json: [{ name: 'Đen', img: 'https://cdn.example/black.jpg' }],
    sizes_json: ['S', 'M', 'L'],
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

const ctx = {
  platformOrigin: 'https://nanoai.vn',
  partnerSlug: '188-partner',
  brand: '188',
  shop,
  industryKey: 'fashion' as const,
  productTypeByInventoryId: {
    'inv-1': 'Túi > Túi đeo chéo',
    '00073cac-aaaa-bbbb-cccc-ddddeeeeffff': 'Túi > Túi đeo chéo',
  },
}

function main() {
  assert(catalogFeedItemId(row({ id: 'inv-1', remarketing_id: 'rm-88' })) === 'rm-88', 'id phải lấy remarketing_id')
  assert(catalogFeedItemId(row({ id: 'inv-1', remarketing_id: '' })) === 'inv-1', 'id fallback inventory.id')
  console.log('OK catalog id: remarketing_id || inventory.id')

  assert(catalogFeedGender(row({ id: 'inv-1', name: 'Áo sơ mi nam' }), 'Áo sơ mi') === 'male', 'gender nam')
  assert(catalogFeedGender(row({ id: 'inv-1', name: 'Áo nữ' }), '') === 'female', 'gender nữ')
  assert(catalogFeedGender(row({ id: 'inv-1', name: 'Áo Việt Nam' }), '') === '', 'không nhầm Việt Nam → male')
  console.log('OK gender suy luận từ tên (không nhầm Việt Nam)')

  const link = pickCatalogProductLandingLink(row({ id: '00073cac-aaaa-bbbb-cccc-ddddeeeeffff' }), {
    platformOrigin: 'https://nanoai.vn',
    partnerSlug: '188-partner',
    shop,
  })
  assert(
    link === 'https://shop.example/products/tui-deo-cheo-nam-00073cac',
    `link PDP shop sai: ${link}`
  )
  console.log('OK landing link: PDP shop đã publish (custom domain)')

  const gmc = buildGoogleMerchantCatalogFeedTsv(
    [
      row({ id: 'inv-1' }),
      row({ id: 'inv-skip', is_active: false }),
      row({ id: 'inv-no-image', image_url: '' }),
    ],
    ctx
  )
  const gmcText = gmc.toString('utf8')
  const gmcLines = gmcText.trim().split('\n')
  assert(gmcLines[0] === GOOGLE_MERCHANT_TSV_HEADERS.join('\t'), 'header TSV Google sai')
  assert(GOOGLE_MERCHANT_TSV_HEADERS.includes('google_product_category'), 'Google thiếu google_product_category')
  assert(GOOGLE_MERCHANT_TSV_HEADERS.includes('gender'), 'Google thiếu gender')
  assert(GOOGLE_MERCHANT_TSV_HEADERS.includes('sale_price_effective_date'), 'Google thiếu sale_price_effective_date')
  assert(gmcLines.length === 2, `Google phải 1 dòng SP, thực tế ${gmcLines.length - 1}`)
  const gmcCols = gmcLines[1].split('\t')
  assert(gmcCols.length === GOOGLE_MERCHANT_TSV_HEADERS.length, `Google số cột ${gmcCols.length} != ${GOOGLE_MERCHANT_TSV_HEADERS.length}`)
  assert(gmcText.includes('rm-88'), 'Google thiếu catalog id')
  assert(gmcText.includes('in_stock'), 'Google thiếu availability')
  assert(gmcText.includes('1299000 VND'), 'Google thiếu price')
  assert(gmcText.includes('999000 VND'), 'Google thiếu sale_price')
  assert(gmcText.includes('Apparel & Accessories'), 'Google thiếu google_product_category fashion')
  assert(gmcText.includes('Túi > Túi đeo chéo'), 'Google thiếu product_type breadcrumb')
  assert(gmcText.includes('\tmale\t'), 'Google thiếu gender male')
  assert(gmcText.includes('Đen'), 'Google thiếu color')
  assert(gmcText.includes('S, M, L'), 'Google thiếu size')
  assert(gmcText.includes('Da bò thật'), 'Google thiếu material')
  assert(gmcText.includes('yes'), 'Google thiếu identifier_exists=yes khi có SKU')
  assert(gmcText.includes('2026-08-01T00:00+0700/2026-08-31T23:59+0700'), 'Google thiếu sale_price_effective_date')
  assert(!gmcText.includes('inv-skip'), 'Google không được gồm SP tắt')
  console.log('OK Google Merchant TSV: đủ cột 188 + sale + gender/color/size/category')

  const fb = buildFacebookCatalogFeedCsv([row({ id: 'inv-1' })], ctx)
  const fbText = fb.toString('utf8').replace(/^\ufeff/, '')
  const fbLines = fbText.trim().split('\r\n')
  assert(fbLines[0] === FACEBOOK_CATALOG_CSV_HEADERS.join(','), 'header CSV Meta sai')
  assert(fbLines[1]?.includes('rm-88'), 'Meta id phải khớp catalog id')
  assert(fbLines[1]?.includes('in stock'), 'Meta availability')
  assert(fbLines[1]?.includes('999000 VND'), 'Meta thiếu sale_price')
  assert(fbLines[1]?.includes('Apparel & Accessories'), 'Meta thiếu fb/google category')
  assert(fbLines[1]?.includes('shop.example/products/'), 'Meta link phải là PDP shop, không phải trang tư vấn')
  console.log('OK Meta CSV: đủ cột 188 + PDP shop + sale_price')

  const tt = buildTiktokCatalogFeedCsv([row({ id: 'inv-1', stock_qty: 0 })], ctx)
  const ttText = tt.toString('utf8').replace(/^\ufeff/, '')
  const ttLines = ttText.trim().split('\r\n')
  assert(ttLines[0] === TIKTOK_CATALOG_CSV_HEADERS.join(','), 'header CSV TikTok sai')
  assert(ttLines[1]?.includes('rm-88'), 'TikTok sku_id phải khớp catalog id')
  assert(ttLines[1]?.includes('out of stock'), 'TikTok phải out of stock khi qty=0')
  assert(ttLines[1]?.includes('1299000 VND'), 'TikTok thiếu price')
  assert(ttLines[1]?.includes('999000 VND'), 'TikTok thiếu sale_price')
  assert(ttLines[1]?.includes('cdn.example/clip.mp4'), 'TikTok thiếu video_link')
  console.log('OK TikTok CSV: sku_id khớp + availability + sale + video')

  console.log('\n✅ ALL S0.11 (Google Merchant + Meta + TikTok catalog feeds) CHECKS PASSED')
}

main()
