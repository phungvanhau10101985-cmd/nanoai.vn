import assert from 'node:assert/strict'
import test from 'node:test'
import { composeItFeatureConsultMessage, type ItFeatureProductContext } from '@/lib/messaging/partner-ai-it-feature-product'
import { aiProductCardsFromPayload } from '@/lib/messaging/partner-ai-product-cards'

const COPY = {
  includes: 'Gồm: {features}.',
  tap: 'Anh/chị bấm nút bên dưới để mở tính năng ạ.',
}

function product(partial: Partial<ItFeatureProductContext> & Pick<ItFeatureProductContext, 'name'>): ItFeatureProductContext {
  return {
    inventory_id: 'inv',
    sku: '',
    description: '',
    consult_note: '',
    price_hint: '',
    product_url: 'https://nanoai.vn/tao-thiep-moi-cuoi-ai',
    image_url: 'https://cdn.example/card.jpg',
    features: [],
    ...partial,
  }
}

test('one IT feature consults from the warehouse note and does not need a card', () => {
  const body = composeItFeatureConsultMessage({
    products: [
      product({
        name: 'Tạo thiệp cưới AI',
        consult_note:
          'Tạo thiệp cưới AI — Tạo thiệp cưới AI, ảnh thiệp và trang mời khách. Mỗi ảnh thiệp 1 credit. Giá chuẩn 6.000đ.',
        features: ['Ảnh thiệp', 'Trang khách mời', '1 credit mỗi ảnh'],
        description: 'Mở công cụ: https://nanoai.vn/tao-thiep-moi-cuoi-ai',
      }),
    ],
    fallback: 'Bạn muốn dùng “Tạo thiệp cưới AI”. Bấm vào link bên dưới để mở tính năng.',
    many: false,
    copy: COPY,
  })
  assert.match(body, /Giá chuẩn 6\.000đ/)
  assert.match(body, /Gồm: Ảnh thiệp; Trang khách mời; 1 credit mỗi ảnh\./)
  assert.match(body, /bấm nút bên dưới/i)
  assert.doesNotMatch(body, /https?:\/\//)
  assert.equal(
    aiProductCardsFromPayload({
      source: 'it_feature_link',
      ai_product_cards: [
        {
          name: 'Tạo thiệp cưới AI',
          image_url: 'https://cdn.example/card.jpg',
          product_url: 'https://nanoai.vn/tao-thiep-moi-cuoi-ai',
        },
      ],
    }).length,
    0
  )
})

test('study help lists a consult line per warehouse product and keeps the lead', () => {
  const body = composeItFeatureConsultMessage({
    products: [
      product({
        name: 'Hỗ trợ làm bài',
        consult_note: 'Hỗ trợ làm bài — Chụp hoặc gõ đề. Giá 30.000đ mỗi tháng.',
        product_url: 'https://nanoai.vn/ho-tro-lam-bai',
      }),
      product({
        name: 'Học ngoại ngữ AI',
        consult_note: '',
        description: 'Mở một buổi luyện nói trực tiếp với AI.\n\nGiá niêm yết 21.000đ.\n\nMở công cụ: https://nanoai.vn/hoc-tieng-anh-ai',
        product_url: 'https://nanoai.vn/hoc-tieng-anh-ai',
      }),
    ],
    fallback: 'Anh/chị muốn học bài. Bấm tính năng bên dưới ạ.',
    many: true,
    copy: COPY,
  })
  assert.match(body, /^Anh\/chị muốn học bài/)
  assert.match(body, /Hỗ trợ làm bài — Chụp hoặc gõ đề/)
  assert.match(body, /Học ngoại ngữ AI: Mở một buổi luyện nói/)
  assert.doesNotMatch(body, /https?:\/\//)
  assert.doesNotMatch(body, /Gồm:/)
})
