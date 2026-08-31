import { describe, expect, it } from 'vitest'
import { mapInventoryRowToPartnerCatalogProduct } from '@/lib/messaging/partner-catalog-api-mapper'

describe('mapInventoryRowToPartnerCatalogProduct', () => {
  it('maps sizes, colors, and shop_ready', () => {
    const product = mapInventoryRowToPartnerCatalogProduct(
      {
        id: 'inv-1',
        partner_id: 'p1',
        name: 'Giày sneaker',
        sku: 'SKU-1',
        description: '["39","40","41"]',
        stock_note: JSON.stringify([{ name: 'Đen', img: 'https://cdn.example/black.jpg' }]),
        stock_qty: 5,
        price_hint: '890.000đ',
        image_url: 'https://cdn.example/main.jpg',
        product_url: 'https://shop.example/giay',
        product_video_url: '',
        consult_note: 'Mô tả ngắn',
        material_note: 'Mô tả dài',
        remarketing_id: 'rm-1',
        material_detail_image_url: 'https://cdn.example/detail.jpg',
        real_use_image_url: '',
        real_use_image_url_2: '',
        sort_order: 1,
        is_active: true,
      } as never,
      { publishedSiteSlug: 'my-shop' }
    )

    expect(product.shop_ready).toBe(true)
    expect(product.sizes).toEqual(['39', '40', '41'])
    expect(product.colors).toEqual([{ name: 'Đen', img: 'https://cdn.example/black.jpg' }])
    expect(product.nanoai_site_path).toBe('/site/my-shop/products/inv-1')
    expect(product.detail_description).toBe('Mô tả dài')
  })

  it('marks shop_ready false when missing https image', () => {
    const product = mapInventoryRowToPartnerCatalogProduct(
      {
        id: 'inv-2',
        partner_id: 'p1',
        name: 'Draft',
        sku: null,
        description: '',
        stock_note: '',
        stock_qty: 0,
        price_hint: '',
        image_url: '',
        product_url: 'https://shop.example/x',
        product_video_url: '',
        consult_note: '',
        material_note: '',
        remarketing_id: '',
        material_detail_image_url: '',
        real_use_image_url: '',
        real_use_image_url_2: '',
        sort_order: 0,
        is_active: true,
      } as never,
      { publishedSiteSlug: null }
    )

    expect(product.shop_ready).toBe(false)
    expect(product.nanoai_site_path).toBeNull()
  })

  it('keeps empty sizes_json / colors_json instead of leftover description JSON', () => {
    const product = mapInventoryRowToPartnerCatalogProduct(
      {
        id: 'inv-bag',
        partner_id: 'p1',
        name: 'Túi xách',
        sku: 'A4827',
        description: '["S","M","L","XL"]',
        stock_note: JSON.stringify([{ name: 'Đỏ', img: 'https://cdn.example/red.jpg' }]),
        sizes_json: [],
        colors_json: [],
        stock_qty: 500,
        price_hint: '2.580.000đ',
        image_url: 'https://cdn.example/bag.jpg',
        product_url: 'https://shop.example/tui',
        product_video_url: '',
        consult_note: '',
        material_note: '',
        remarketing_id: 'A857587313162a188A4827',
        material_detail_image_url: '',
        real_use_image_url: '',
        real_use_image_url_2: '',
        sort_order: 1,
        is_active: true,
      } as never,
      { publishedSiteSlug: 'my-shop' }
    )

    expect(product.sizes).toEqual([])
    expect(product.colors).toEqual([])
  })
})
