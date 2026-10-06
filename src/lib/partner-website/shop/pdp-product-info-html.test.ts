import assert from 'node:assert/strict'
import test from 'node:test'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  isPdpProductInfoJsonBlob,
  pdpDescriptionBodyHtml,
  pdpProductInfoHtml,
  shopDisplayConsultNote,
} from '@/lib/partner-website/shop/pdp-product-info-html'

const CONSULT_JSON = JSON.stringify({
  product_info: {
    name_vi: 'Áo sơ mi nữ tay ngắn cổ V ren thêu họa tiết, phom vai suông',
    name: 'Áo sơ mi nữ tay ngắn cổ V ren thêu họa tiết, phom vai suông — màu xanh hồ',
    display_name_vi: 'Áo sơ mi nữ tay ngắn cổ V ren thêu họa tiết, phom vai suông — màu xanh hồ',
    material_vi: 'Vải cotton pha ren thêu',
    category: {
      level_1: 'Thời trang Nữ',
      level_2: 'Áo thun & kiểu Nữ',
      level_3: 'áo thun nữ cổ tròn basic',
    },
    target_audience_suggestion_vi: 'Phù hợp Nữ 18–35 tuổi, yêu thích phong cách ngọt ngào, thanh lịch',
    sku: 'Q2477',
  },
  specifications: {
    occasion: 'Đi làm, dạo phố, gặp gỡ bạn bè',
    thong_so_kich_thuoc_vi: 'Form vai suông',
    style: 'Ngọt ngào, thanh lịch',
    upper_material: 'Vải cotton pha ren thêu',
  },
  variants: {
    colors: 'màu xanh hồ',
    sizes: 'S, M, L, XL',
  },
})

test('shopDisplayConsultNote keeps plain stylist text', () => {
  assert.equal(
    shopDisplayConsultNote('Phù hợp Nữ 18–35 tuổi, phong cách thanh lịch.'),
    'Phù hợp Nữ 18–35 tuổi, phong cách thanh lịch.'
  )
})

test('shopDisplayConsultNote extracts audience suggestion from catalog JSON', () => {
  assert.equal(
    shopDisplayConsultNote(CONSULT_JSON),
    'Phù hợp Nữ 18–35 tuổi, yêu thích phong cách ngọt ngào, thanh lịch'
  )
  assert.equal(shopDisplayConsultNote('{"product_info":{"sku":"Q2477"}}'), '')
})

test('pdp description ignores leftover product_info JSON', () => {
  assert.equal(pdpDescriptionBodyHtml(CONSULT_JSON), '')
  assert.equal(isPdpProductInfoJsonBlob(CONSULT_JSON), true)
  assert.match(pdpDescriptionBodyHtml('Vải cotton mềm.\n\nGiặt máy.'), /Vải cotton mềm/)
  assert.match(
    pdpDescriptionBodyHtml('<p>Mô tả</p><img src="https://cdn.example/a.jpg" alt="x">'),
    /loading="lazy"/
  )
})

test('pdp specs render JSON groups instead of a raw blob', () => {
  const html = pdpProductInfoHtml(JSON.parse(CONSULT_JSON), 'vi', getPartnerSiteShopCopy('vi'), {})
  assert.match(html, /Gợi ý tư vấn/)
  assert.match(html, /Phù hợp Nữ 18–35/)
  assert.match(html, /Thông số kỹ thuật/)
  assert.match(html, /Phân loại/)
  assert.match(html, /Q2477/)
  assert.doesNotMatch(html, /name_vi/)
  assert.doesNotMatch(html, /display_name_vi/)
  assert.doesNotMatch(html, /\{"product_info"/)
})

test('pdp specs omit image localization bookkeeping and source urls', () => {
  const info = {
    ...JSON.parse(CONSULT_JSON),
    image_localization: {
      language: 'vi',
      processed_at: '2026-10-05T00:00:00.000Z',
      results: {
        'https://img.alicdn.com/img/ibank/O1CN01OIWqu61IOfyrhh8Yg.jpg': {
          final_url: 'https://cdn.example/localized.jpg',
          status: 'processed',
          message: 'ok',
        },
      },
    },
    image_consult_context: { lines: ['chữ trên ảnh'] },
  }
  const html = pdpProductInfoHtml(info, 'vi', getPartnerSiteShopCopy('vi'), {})
  assert.match(html, /Q2477/)
  assert.match(html, /Thông số kỹ thuật/)
  assert.doesNotMatch(html, /Image Localization|image_localization|alicdn|final_url|processed_at|image_consult/i)
})
