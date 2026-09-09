import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { productDataToInventoryExcelInsert } from './product-data-to-inventory'

describe('productDataToInventoryExcelInsert', () => {
  it('maps scrape draft to catalog 188 remarketing id A/T', () => {
    const row = productDataToInventoryExcelInsert({
      product_id: 'T1234567890',
      name: 'Váy hoa',
      price: 1490000,
      origin: 'taobao',
      chinese_name: '碎花裙',
      shop_name_chinese: '旗舰店',
      main_image: 'https://img.alicdn.com/a.jpg',
      images: ['https://img.alicdn.com/a.jpg'],
      gallery: [],
      colors: [{ name: 'Đỏ', img: 'https://img.alicdn.com/red.jpg' }],
      sizes: ['S', 'M'],
      available: 12,
      link_default: 'https://item.taobao.com/item.htm?id=1234567890',
    })
    assert.ok(row)
    assert.equal(row.remarketing_id, 'T1234567890')
    assert.equal(row.name, 'Váy hoa')
    assert.equal(row.catalogFormat, '188')
    assert.equal(row.catalog?.source_origin, 'taobao')
    assert.equal(row.catalog?.chinese_name, '碎花裙')
    assert.deepEqual(row.catalog?.sizes, ['S', 'M'])
    assert.equal(row.stock_qty, 12)
  })

  it('returns null without product_id', () => {
    assert.equal(productDataToInventoryExcelInsert({ name: 'Áo' }), null)
  })
})
