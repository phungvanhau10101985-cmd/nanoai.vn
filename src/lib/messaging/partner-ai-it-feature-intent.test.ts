import assert from 'node:assert/strict'
import test from 'node:test'
import { matchItFeatureIntent, type ItFeatureCatalogRow } from '@/lib/messaging/partner-ai-it-feature-intent'
import { shopIndustryIntentBranch } from '@/lib/messaging/partner-ai-industry-intent'

const CATALOG: ItFeatureCatalogRow[] = [
  { id: '1', name: 'Thử đồ 1 người', product_url: 'https://nanoai.vn/thu-do-online/1-nguoi' },
  { id: '2', name: 'Thử đồ 2 người', product_url: 'https://nanoai.vn/thu-do-online/2-nguoi' },
  { id: '3', name: 'Thử đồ 3 người', product_url: 'https://nanoai.vn/thu-do-online/3-nguoi' },
  { id: '4', name: 'Thử đồ 4 người', product_url: 'https://nanoai.vn/thu-do-online/4-nguoi' },
  { id: '5', name: 'Thử đồ 5 người', product_url: 'https://nanoai.vn/thu-do-online/5-nguoi' },
  { id: 'logo', name: 'Thiết kế logo', product_url: 'https://nanoai.vn/thiet-ke-logo' },
  { id: 'png', name: 'Xóa nền PNG', product_url: 'https://nanoai.vn/xoa-nen-png' },
  { id: 'veo', name: 'Tạo video AI (Veo)', product_url: 'https://nanoai.vn/tao-video-tu-anh' },
  { id: 'mv', name: 'Video âm nhạc AI (Flash + Veo)', product_url: 'https://nanoai.vn/flow-nhac-video-veo' },
  { id: 'dress', name: 'Váy hoa', product_url: 'https://shop.example/products/vay-hoa' },
]

test('one named feature resolves to that link only', () => {
  const one = matchItFeatureIntent('mình muốn thử đồ 1 người', CATALOG)
  assert.equal(one.kind, 'links')
  if (one.kind !== 'links') return
  assert.deepEqual(one.rows.map((row) => row.id), ['1'])

  const logo = matchItFeatureIntent('Em nhận tin tư vấn về mẫu Thiết kế logo — anh/chị muốn hỏi thêm điểm nào ạ?', CATALOG)
  assert.equal(logo.kind, 'links')
  if (logo.kind !== 'links') return
  assert.equal(logo.rows[0]?.product_url, 'https://nanoai.vn/thiet-ke-logo')
})

test('try-on without a person count lists those features, not logo', () => {
  const many = matchItFeatureIntent('shop có thử đồ không', CATALOG)
  assert.equal(many.kind, 'links')
  if (many.kind !== 'links') return
  assert.deepEqual(
    many.rows.map((row) => row.id),
    ['1', '2', '3', '4', '5']
  )
})

test('greeting and thanks do not pick a feature', () => {
  assert.equal(matchItFeatureIntent('xin chào shop', CATALOG).kind, 'clarify')
  assert.equal(matchItFeatureIntent('cảm ơn shop', CATALOG).kind, 'pause')
})

test('a fashion product URL is not a feature match', () => {
  assert.equal(matchItFeatureIntent('cho xem váy hoa size M', CATALOG).kind, 'clarify')
})

test('industry branches stay separate', () => {
  assert.equal(shopIndustryIntentBranch('it'), 'it')
  assert.equal(shopIndustryIntentBranch('fashion'), 'fashion')
  assert.equal(shopIndustryIntentBranch('food'), 'food')
  assert.equal(shopIndustryIntentBranch('hotel'), 'hotel')
  assert.equal(shopIndustryIntentBranch(null), 'other')
})
