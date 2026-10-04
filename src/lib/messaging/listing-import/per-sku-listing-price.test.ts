import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pandamallRowToProductData } from '@/lib/messaging/listing-import/pandamall-scraper'
import { listingSellVndForCny } from '@/lib/messaging/listing-import/listing-sell-vnd'
import {
  colorsHaveTieredPrices,
  inventoryCardTieredPrices,
  listingLabelIsModelCode,
  listingPricePrefix,
  listingPricePrefixRuntimeJs,
  shopProductForSelectedColor,
  storedVariantListPrice,
} from '@/lib/messaging/listing-import/per-sku-listing-price'
import { vipomallApiDetailToProductData } from '@/lib/messaging/listing-import/vipomall-api'
import { mergeListingOverlayIntoProductData } from '@/lib/messaging/listing-import/scrape-common'

describe('listing sell price per code', () => {
  it('uses the 188 grid: 77 CNY → 830.000đ and 440 CNY → 3.940.000đ', () => {
    assert.equal(listingSellVndForCny(77), 830_000)
    assert.equal(listingSellVndForCny(440), 3_940_000)
  })

  it('keeps model codes and still translates color names', () => {
    assert.equal(listingLabelIsModelCode('2W41-15GBN-AC220V'), true)
    assert.equal(listingLabelIsModelCode('红色'), false)
  })

  it('maps Vipomall API SKUs to each listing price and drops out of stock', () => {
    const pd = vipomallApiDetailToProductData(
      {
        product_name: 'Van điện từ',
        original_product_name: '电磁阀',
        shop_name: 'yujianhong1',
        product_sku_info_list: [
          {
            price: 440,
            stock: 12,
            img_url: 'https://cbu01.alicdn.com/img/ibank/dear.jpg',
            sku_prop_list: [{ prop_name: '型号', value_name: '2W41-40GBN-AC220V' }],
          },
          {
            price: 77,
            stock: 20,
            img_url: 'https://cbu01.alicdn.com/img/ibank/cheap.jpg',
            sku_prop_list: [{ prop_name: '型号', value_name: '2W41-15GBN-AC220V' }],
          },
          {
            price: 90,
            stock: 0,
            sku_prop_list: [{ prop_name: '型号', value_name: '2W41-OOS' }],
          },
        ],
      },
      'https://vipomall.vn/san-pham/1217276629?platform_type=10&merchant_id=101',
      '1217276629',
      10
    )
    const colors = pd.colors as { name: string; price: number; price_cny: number; img: string }[]
    assert.equal(colors.length, 2)
    assert.equal(colors[0].name, '2W41-15GBN-AC220V')
    assert.equal(colors[0].price, 830_000)
    assert.equal(colors[0].price_cny, 77)
    assert.equal(colors[1].price, 3_940_000)
    assert.equal(pd.price, 830_000)
    assert.equal(pd.cost_cny, 77)
    assert.equal(pd.pro_lower_price, '77')
    assert.equal(pd.pro_high_price, '440')
    assert.equal(pd.main_image, 'https://cbu01.alicdn.com/img/ibank/cheap.jpg')
    assert.equal(colorsHaveTieredPrices(colors), true)
    const variants = (pd.product_info as { variants: { variant_only?: boolean; pairs: unknown[] } }).variants
    assert.equal(variants.variant_only, true)
    assert.deepEqual(variants.pairs, [])
  })

  it('maps PandaMall CNY per color with the same listing price', () => {
    const pd = pandamallRowToProductData(
      {
        title: 'Van',
        layout_mode: 'color_only',
        colors: [
          { label: '2W41-40', image_url: 'https://cbu01.alicdn.com/img/ibank/dear.jpg', price_cny: '440', in_stock: true, stock: 4 },
          { label: '2W41-15', image_url: 'https://cbu01.alicdn.com/img/ibank/cheap.jpg', price_cny: '77', in_stock: true, stock: 9 },
        ],
        variant_rows: [
          { color: '2W41-40', size: '', price_cny: '440', in_stock: true, stock: 4 },
          { color: '2W41-15', size: '', price_cny: '77', in_stock: true, stock: 9 },
        ],
        gallery_images: ['https://cbu01.alicdn.com/img/ibank/gallery.jpg'],
      },
      'https://pandamall.vn/1688/detail/1217276629',
      '1217276629',
      '1688'
    )
    const colors = pd.colors as { name: string; price: number }[]
    assert.equal(colors[0].name, '2W41-15')
    assert.equal(colors[0].price, 830_000)
    assert.equal(colors[1].price, 3_940_000)
    assert.equal(pd.price, 830_000)
    assert.equal(pd.cost_cny, 77)
  })

  it('keeps one product price when a published color has no stored price', () => {
    assert.equal(
      storedVariantListPrice({
        colors: [{ name: 'Đỏ', img: 'https://img.alicdn.com/a.jpg' }],
        productInfo: null,
        colorName: 'Đỏ',
      }),
      null
    )
    const priced = shopProductForSelectedColor(
      { priceAmount: 830_000, salePriceAmount: 700_000, colors: [{ name: 'Đỏ' }, { name: 'Xanh', price: 3_940_000 }] },
      'Xanh'
    )
    assert.equal(priced.priceAmount, 3_940_000)
    assert.equal(priced.salePriceAmount, Math.round(3_940_000 * (700_000 / 830_000)))
  })

  it('does not let an excel overlay replace prices already stored per code', () => {
    const pd: Record<string, unknown> = {
      origin: '1688',
      link_default: 'https://detail.1688.com/offer/1.html',
      price: 830_000,
      cost_cny: 77,
      pro_lower_price: '77',
      pro_high_price: '440',
      colors: [{ name: 'A', price: 830_000, price_cny: 77 }],
    }
    mergeListingOverlayIntoProductData(pd, { price: 1000, pro_lower_price: '1', pro_high_price: '2' })
    assert.equal(pd.price, 830_000)
    assert.equal(pd.pro_lower_price, '77')
    assert.equal(pd.cost_cny, 77)
  })

  it('prefixes the cheapest price in every shop locale when codes differ', () => {
    assert.equal(listingPricePrefix('vi', true), 'từ ')
    assert.equal(listingPricePrefix('en', true), 'from ')
    assert.equal(listingPricePrefix('zh', true), '低至 ')
    assert.equal(listingPricePrefix('ja', true), '〜 ')
    assert.equal(listingPricePrefix('ko', true), '최저 ')
    assert.equal(listingPricePrefix('vi', true, true), '')
    assert.equal(listingPricePrefix('vi', false), '')
    assert.equal(
      inventoryCardTieredPrices({
        is_clearance: false,
        tiered_prices: true,
      }),
      true
    )
    assert.equal(inventoryCardTieredPrices({ is_clearance: true, tiered_prices: true }), false)
    const js = listingPricePrefixRuntimeJs('en')
    assert.match(js, /function priceFromPrefix/)
    assert.match(js, /"from "/)
  })
})
