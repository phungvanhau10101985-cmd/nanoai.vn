import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  inferListingImportSource,
  listingRowToPandamallImportUrl,
  listingRowToVipomallImportUrl,
} from './listing-import-urls'
import { mergeListingOverlayIntoProductData } from './scrape-common'
import { cnyExchangeMultiplierFromGrid, type ParsedTaobaoCardRow } from './taobao-cards-html-parse'

function row(partial: Partial<ParsedTaobaoCardRow>): ParsedTaobaoCardRow {
  return {
    row: 1,
    item_id: '',
    item_url: '',
    main_image_url: '',
    title: '',
    shop_name: '',
    shop_name_chinese: '',
    chinese_name: '',
    shop_app_uid: '',
    seller_nick: '',
    tags: '',
    price_raw: '',
    price_link: '',
    sales_text: '',
    sku_thumb_urls: '',
    sku_thumb_count: 0,
    price_cny_approx: null,
    cny_exchange_multiplier: null,
    ...partial,
  }
}

describe('listing import urls + overlay', () => {
  it('maps Taobao T-id to Vipomall platform 21', () => {
    assert.equal(
      listingRowToVipomallImportUrl(row({ item_id: 'T1234567890' })),
      'https://vipomall.vn/san-pham/1234567890?platform_type=21'
    )
  })

  it('maps 1688 A-id to Vipomall platform 10', () => {
    assert.equal(
      listingRowToVipomallImportUrl(row({ item_id: 'A945111', item_url: 'https://detail.1688.com/offer/945111.html' })),
      'https://vipomall.vn/san-pham/945111?platform_type=10'
    )
  })

  it('maps Taobao T-id to PandaMall', () => {
    assert.equal(
      listingRowToPandamallImportUrl(row({ item_id: 'T1234567890' })),
      'https://pandamall.vn/taobao/detail/1234567890'
    )
  })

  it('infers source from URL host', () => {
    assert.equal(inferListingImportSource('https://pandamall.vn/1688/detail/1'), 'pandamall')
    assert.equal(inferListingImportSource('https://vipomall.vn/san-pham/1'), 'vipomall')
    assert.equal(inferListingImportSource('https://example.com/x', 'panda'), 'pandamall')
  })

  it('uses the 188 CNY grid multipliers', () => {
    assert.equal(cnyExchangeMultiplierFromGrid(80), 3)
    assert.equal(cnyExchangeMultiplierFromGrid(100), 2.9)
    assert.equal(cnyExchangeMultiplierFromGrid(0), 0)
  })

  it('overlays listing Chinese name and VND price', () => {
    const pd: Record<string, unknown> = { name: 'Áo', price: 1 }
    mergeListingOverlayIntoProductData(pd, {
      chinese_name: '连衣裙',
      shop_name_chinese: '旗舰店',
      price: 1490000,
      pro_lower_price: '10',
    })
    assert.equal(pd.chinese_name, '连衣裙')
    assert.equal(pd.shop_name_chinese, '旗舰店')
    assert.equal(pd.price, 1490000)
    assert.equal(pd.pro_lower_price, '10')
  })
})
