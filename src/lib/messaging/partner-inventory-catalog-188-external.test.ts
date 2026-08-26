import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogFieldsFromExternalProduct } from '@/lib/messaging/partner-inventory-catalog-188'

test('catalogFieldsFromExternalProduct maps 188-like REST product fields', () => {
  const catalog = catalogFieldsFromExternalProduct({
    product_id: 'A1001',
    code: 'B3630',
    name: 'Giày Chelsea Boot',
    description: 'Da mờ, đế cao su',
    price: 1120000,
    available: 12,
    sizes: ['38', '39', '40'],
    colors: [{ name: 'Đen', img: 'https://cdn.example.com/den.jpg' }],
    images: ['https://cdn.example.com/a.jpg'],
    gallery: ['https://cdn.example.com/detail.jpg'],
    main_image: 'https://cdn.example.com/main.jpg',
    category: 'Giày dép nam',
    subcategory: 'Giày boot',
    sub_subcategory: 'Chelsea',
    brand_name: '188',
    material: 'Da bò',
    product_info: { form: 'ôm' },
    slug: 'giay-chelsea-boot',
  })
  assert.ok(catalog)
  assert.equal(catalog?.sizes.join(','), '38,39,40')
  assert.equal(catalog?.colors[0]?.name, 'Đen')
  assert.equal(catalog?.category_l1, 'Giày dép nam')
  assert.equal(catalog?.category_l3, 'Chelsea')
  assert.equal(catalog?.brand_name, '188')
  assert.equal(catalog?.material_note, 'Da bò')
  assert.equal(catalog?.gallery_urls[0], 'https://cdn.example.com/main.jpg')
  assert.ok(catalog?.gallery_urls.includes('https://cdn.example.com/a.jpg'))
  assert.deepEqual(catalog?.detail_image_urls, ['https://cdn.example.com/detail.jpg'])
  assert.equal(catalog?.product_info_json?.form, 'ôm')
})

test('catalogFieldsFromExternalProduct returns null for empty object', () => {
  assert.equal(catalogFieldsFromExternalProduct({}), null)
  assert.equal(catalogFieldsFromExternalProduct(null), null)
})
