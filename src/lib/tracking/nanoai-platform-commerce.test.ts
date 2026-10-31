import assert from 'node:assert/strict'
import test from 'node:test'
import { toNanoAiFeatureCatalogIdFromHref } from '@/lib/catalog/nanoai-feature-catalog-id'
import {
  CURRICULUM_CONTENT_ID,
  STUDENT_PLAN_CONTENT_ID,
  designPurchaseHref,
  isFeatureCreateLabel,
  parsePlatformPurchases,
  serializePlatformPurchases,
} from '@/lib/tracking/nanoai-platform-commerce'

test('design credit spend maps to the catalog feature path', () => {
  assert.equal(designPurchaseHref('tao-anh-tu-chu'), '/tao-anh-tu-chu')
  assert.equal(designPurchaseHref('xay-nha-3d'), '/xay-nha-tu-dat-nen')
  assert.equal(designPurchaseHref('wedding-card-text-polish'), '/tao-thiep-moi-cuoi-ai')
  assert.equal(designPurchaseHref('wedding-card-sample-compose'), '/tao-thiep-moi-cuoi-ai')
  assert.equal(designPurchaseHref('hub-chat'), null)
  assert.equal(designPurchaseHref('english-coach-live-lesson-purchase'), null)
  assert.equal(designPurchaseHref('curriculum_from_image'), null)
})

test('create buttons are add-to-cart and navigation or pay buttons are not', () => {
  assert.equal(isFeatureCreateLabel('Tạo ảnh'), true)
  assert.equal(isFeatureCreateLabel('Tạo giáo trình'), true)
  assert.equal(isFeatureCreateLabel('Tạo thiệp mới'), true)
  assert.equal(isFeatureCreateLabel('Generate'), true)
  assert.equal(isFeatureCreateLabel('生成图片'), true)
  assert.equal(isFeatureCreateLabel('Tạo ảnh (1,5 credit)'), true)
  assert.equal(isFeatureCreateLabel('Lưu và xuất bản'), false)
  assert.equal(isFeatureCreateLabel('Khách mời'), false)
  assert.equal(isFeatureCreateLabel('Nạp credit'), false)
  assert.equal(isFeatureCreateLabel('Xóa'), false)
})

test('package content ids match the catalog feed', () => {
  assert.equal(CURRICULUM_CONTENT_ID, toNanoAiFeatureCatalogIdFromHref('/tao-giao-trinh'))
  assert.equal(STUDENT_PLAN_CONTENT_ID, 'feature_goi_hoc_sinh')
})

test('purchase cookie round-trips the order value', () => {
  const raw = serializePlatformPurchases([
    { contentId: 'feature_tao_anh_tu_chu', valueVnd: 12000, orderId: 'cr_1', contentName: 'Tạo ảnh' },
  ])
  const rows = parsePlatformPurchases(raw)
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.contentId, 'feature_tao_anh_tu_chu')
  assert.equal(rows[0]?.valueVnd, 12000)
  assert.equal(rows[0]?.orderId, 'cr_1')
})
