import assert from 'node:assert/strict'
import test from 'node:test'
import { toNanoAiFeatureCatalogIdFromHref } from '@/lib/catalog/nanoai-feature-catalog-id'
import {
  CURRICULUM_CONTENT_ID,
  STUDENT_PLAN_CONTENT_ID,
  creditPurchaseContent,
  designPurchaseHref,
  isFeatureCartAction,
  isFeatureCreateLabel,
  languageCartRouteForLocation,
  parsePlatformPurchases,
  serializePlatformPurchases,
} from '@/lib/tracking/nanoai-platform-commerce'

test('design credit spend maps to the catalog feature path', () => {
  assert.equal(designPurchaseHref('tao-anh-tu-chu'), '/tao-anh-tu-chu')
  assert.equal(designPurchaseHref('xay-nha-3d'), '/xay-nha-tu-dat-nen')
  assert.equal(designPurchaseHref('wedding-card-text-polish'), '/tao-thiep-moi-cuoi-ai')
  assert.equal(designPurchaseHref('wedding-card-sample-compose'), '/tao-thiep-moi-cuoi-ai')
  assert.equal(designPurchaseHref('tao-thiep-moi-cuoi-ai'), '/tao-thiep-moi-cuoi-ai')
  assert.equal(designPurchaseHref('hub-chat'), null)
  assert.equal(designPurchaseHref('english-coach-live-lesson-purchase'), null)
  assert.equal(designPurchaseHref('curriculum_from_image'), null)
})

test('every credit charge is a purchase, catalog id when the feature has a page', () => {
  assert.equal(
    creditPurchaseContent('tao-thiep-moi-cuoi-ai')?.contentId,
    toNanoAiFeatureCatalogIdFromHref('/tao-thiep-moi-cuoi-ai'),
  )
  assert.equal(creditPurchaseContent('english-coach-live-lesson-purchase')?.contentId, 'feature_english_coach_live_lesson_purchase')
  assert.equal(creditPurchaseContent('monthly_service_student')?.contentId, STUDENT_PLAN_CONTENT_ID)
  assert.equal(creditPurchaseContent('curriculum_from_image')?.contentId, CURRICULUM_CONTENT_ID)
  assert.equal(creditPurchaseContent(''), null)
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
  assert.equal(isFeatureCreateLabel('Mở trang Tạo bài thi'), false)
})

test('each feature carts on its start action', () => {
  assert.equal(isFeatureCartAction('/thu-do-online', 'Thử đồ'), true)
  assert.equal(isFeatureCartAction('/phuc-dung-anh', 'Phục dựng'), true)
  assert.equal(isFeatureCartAction('/dich-anh-tai-lieu', 'Dịch'), true)
  assert.equal(isFeatureCartAction('/tao-bai-hat-lyria-3', 'Tạo nhạc'), true)
  assert.equal(isFeatureCartAction('/tao-bai-thi', 'Tạo bài thi'), true)
  assert.equal(isFeatureCartAction('/tao-bai-thi', 'Create exam'), true)
  assert.equal(isFeatureCartAction('/tao-bai-thi', 'Tạo bài thi khác'), false)
  assert.equal(isFeatureCartAction('/tao-bai-thi', 'Tạo câu trắc nghiệm'), false)
  assert.equal(isFeatureCartAction('/tao-bai-tap-ve-nha', 'Tạo bài tập về nhà'), true)
  assert.equal(isFeatureCartAction('/tao-bai-tap-ve-nha', 'Create another homework'), false)
  assert.equal(isFeatureCartAction('/ho-tro-lam-bai', 'Gửi'), true)
  assert.equal(isFeatureCartAction('/gia-su-ai', 'Send'), true)
  assert.equal(isFeatureCartAction('/gia-su-ai', '发送'), true)
  assert.equal(isFeatureCartAction('/hoc-tieng-anh-ai', 'Bắt đầu buổi học'), true)
  assert.equal(isFeatureCartAction('/hoc-tieng-han', '수업 시작'), true)
  assert.equal(isFeatureCartAction('/hoc-tieng-anh-ai', 'Tạo bài học'), false)
  assert.equal(isFeatureCartAction('/hoc-tieng-anh-ai', 'Tạo giáo trình'), false)
  assert.equal(isFeatureCartAction('/ghi-am-bao-cao-cuoc-hop', 'Tạo báo cáo AI'), true)
  assert.equal(isFeatureCartAction('/ghi-am-bao-cao-cuoc-hop', 'Generate AI report'), true)
  assert.equal(isFeatureCartAction('/ghi-am-bao-cao-cuoc-hop', 'Tạo cuộc họp mới'), false)
  assert.equal(isFeatureCartAction('/ghi-am-bao-cao-cuoc-hop', 'Bắt đầu ghi'), false)
  assert.equal(isFeatureCartAction('/tao-giao-trinh', 'Tạo giáo trình'), false)
  assert.equal(isFeatureCartAction('/lop', 'Tạo lớp'), false)
  assert.equal(isFeatureCartAction('/tao-thiep-moi-cuoi-ai', 'Tạo thiệp mới'), false)
  assert.equal(languageCartRouteForLocation('/hoc-tieng-anh-ai/luyen-noi', '?hoc=ja&me=vi'), '/hoc-tieng-nhat')
  assert.equal(languageCartRouteForLocation('/hoc-bai-hoc-co-san', '?hoc=vi&me=en'), '/hoc-tieng-viet')
  assert.equal(languageCartRouteForLocation('/hoc-tieng-anh-ai', ''), null)
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
