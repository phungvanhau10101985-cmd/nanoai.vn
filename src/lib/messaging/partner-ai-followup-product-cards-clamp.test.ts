import assert from 'node:assert/strict'
import test from 'node:test'
import type { Database } from '@/types/database.types'
import {
  clampProductCardsToLastConsultedRow,
  partnerAiProductCardFromInventoryRow,
} from './partner-ai-followup-product-cards-clamp'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

const cf2717 = {
  id: '04671253-cc4d-47a2-8e12-d0964e19e7f8',
  name: 'Bộ vest nữ Cf2717',
  sku: 'Cf2717',
  image_url: 'https://cdn.gudo.vn/cf2717.jpg',
  product_url: 'https://gudo.vn/products/bo-vest-cf2717',
  price_hint: '1.290.000đ',
  remarketing_id: null,
  stock_note: null,
  material_detail_image_url: null,
  real_use_image_url: null,
  real_use_image_url_2: null,
  product_video_url: null,
} as unknown as InvRow

test('matching model card is rebuilt entirely from the authoritative inventory row', () => {
  const result = clampProductCardsToLastConsultedRow(
    [
      {
        name: 'Tên model có thể sai',
        sku: 'Cf2717',
        image_url: 'https://wrong.example/dress.jpg',
        product_url: 'https://wrong.example/products/dress',
      },
    ],
    cf2717
  )

  assert.deepEqual(result, [partnerAiProductCardFromInventoryRow(cf2717)])
})

test('foreign inventory_id cannot match merely because SKU belongs to the anchor', () => {
  const result = clampProductCardsToLastConsultedRow(
    [
      {
        name: 'Bộ vest nữ Cf2717',
        sku: 'Cf2717',
        inventory_id: '4a761b66-889b-4fb2-ba64-38d0ab2a9b96',
        image_url: 'https://wrong.example/cz9627.jpg',
        product_url: 'https://wrong.example/products/cz9627',
      },
    ],
    cf2717
  )

  assert.deepEqual(result, [])
  assert.equal(partnerAiProductCardFromInventoryRow(cf2717)?.inventory_id, cf2717.id)
})
