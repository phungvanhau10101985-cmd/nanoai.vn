import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseCookieText } from '@/lib/messaging/listing-import/listing-import-cookies'
import { listingImportColorNeedsTranslate } from '@/lib/messaging/listing-import/listing-import-color-translate'
import { pandamallRowToProductData } from '@/lib/messaging/listing-import/pandamall-scraper'
import {
  isListingImportScrapeDict,
  listingImportScrapeEvaluateExpression,
} from '@/lib/messaging/listing-import/playwright-browser'
import { vipomallRowToProductData } from '@/lib/messaging/listing-import/vipomall-scraper'
import {
  extractCjkAttributePairs,
  pickCnyPriceFromScrapeRow,
} from '@/lib/messaging/listing-import/listing-import-body-specs'
import { applyListingYearSanitizeToProductData } from '@/lib/messaging/listing-import/listing-import-year-sanitize'
import {
  inferQuestionGroupIdFromProductName,
  inferRatingGroupIdFromText,
  applyListingImportRatingGroups,
  RATING_GROUP_ID_UNASSIGNED,
} from '@/lib/messaging/listing-import/listing-import-rating-groups'

describe('listing import cookies', () => {
  it('parses Cookie-Editor JSON list', () => {
    const cookies = parseCookieText(
      JSON.stringify([
        { name: 'session', value: 'abc', domain: '.vipomall.vn', path: '/', sameSite: 'Lax' },
      ])
    )
    assert.equal(cookies.length, 1)
    assert.equal(cookies[0].name, 'session')
    assert.equal(cookies[0].domain, '.vipomall.vn')
    assert.equal(cookies[0].sameSite, 'Lax')
  })
})

describe('listing import rating groups', () => {
  it('maps túi xách nữ and áo thun nam', () => {
    assert.equal(inferRatingGroupIdFromText('túi xách nữ da bò'), 69)
    assert.equal(inferRatingGroupIdFromText('áo thun nam cotton'), 51)
  })
  it('maps question group from product name', () => {
    assert.equal(inferQuestionGroupIdFromProductName('Áo thun nam nữ'), 99)
    assert.equal(inferQuestionGroupIdFromProductName('Áo thun nam'), 100)
    assert.equal(inferQuestionGroupIdFromProductName('Váy đầm nữ'), 88)
  })
  it('assigns 888 when no keyword match', () => {
    const pd: Record<string, unknown> = { name: 'Widget lạ xyz' }
    const warnings: string[] = []
    applyListingImportRatingGroups(pd, warnings)
    assert.equal(pd.group_rating, RATING_GROUP_ID_UNASSIGNED)
    assert.equal(pd.group_question, 99)
  })
})

describe('listing import color translate', () => {
  it('detects CJK and English fashion colors', () => {
    assert.equal(listingImportColorNeedsTranslate('黑色'), true)
    assert.equal(listingImportColorNeedsTranslate('Black Suede'), true)
    assert.equal(listingImportColorNeedsTranslate('Đen nhám'), false)
    assert.equal(listingImportColorNeedsTranslate('XL'), false)
  })
})

describe('listing import Playwright scrape evaluate', () => {
  it('invokes Python-style () => scrape JS so Node evaluate returns a dict', () => {
    assert.equal(listingImportScrapeEvaluateExpression('() => ({ a: 1 })'), '(() => ({ a: 1 }))()')
    assert.equal(listingImportScrapeEvaluateExpression('1 + 1'), '1 + 1')
    assert.equal(isListingImportScrapeDict(undefined), false)
    assert.equal(isListingImportScrapeDict([]), false)
    assert.equal(isListingImportScrapeDict({ title: 'x' }), true)
  })
})

describe('vipomallRowToProductData (188 product_data)', () => {
  it('keeps all swatch colors, color-only sizes=[], A-id + 1688 supply URL', () => {
    const pd = vipomallRowToProductData(
      {
        title: 'Túi da',
        swatch_colors: [
          { label: 'Đen', image_url: 'https://img.alicdn.com/black.jpg' },
          { label: 'Nâu', image_url: 'https://img.alicdn.com/brown.jpg' },
        ],
        colors: [{ label: 'Đen', image_url: 'https://img.alicdn.com/black.jpg' }],
        variant_rows: [
          { color: 'Đen', size: '', in_stock: true, stock: 8, price_vnd: 390000, stock_text: 'Có sẵn 8 SP' },
        ],
        gallery_images: ['https://img.alicdn.com/g1.jpg'],
        detail_images: ['https://img.alicdn.com/d1.jpg'],
      },
      'https://vipomall.vn/san-pham/1024630591599?platform_type=10',
      '1024630591599',
      10
    )
    assert.equal(pd.product_id, 'A1024630591599')
    assert.equal(pd.origin, '1688')
    assert.equal(pd.link_default, 'https://detail.1688.com/offer/1024630591599.html')
    assert.deepEqual(pd.sizes, [])
    const colors = pd.colors as { name: string }[]
    assert.equal(colors.length, 2)
    assert.ok(colors.some((c) => c.name === 'Nâu'))
    const variants = (pd.product_info as Record<string, unknown>).variants as Record<string, unknown>
    assert.equal(variants.variant_only, true)
  })

  it('keeps extra colors[] that are not in in-stock variant rows (188 has_extra_swatch_colors)', () => {
    const pd = vipomallRowToProductData(
      {
        title: 'Áo',
        colors: [
          { label: 'Đỏ', image_url: 'https://img.alicdn.com/red.jpg' },
          { label: 'Xanh', image_url: 'https://img.alicdn.com/blue.jpg' },
        ],
        variant_rows: [
          { color: 'Đỏ', size: 'M', in_stock: true, stock: 3, price_vnd: 199000, stock_text: 'Có sẵn 3 SP' },
          { color: 'Xanh', size: 'M', in_stock: false, stock: 0, stock_text: 'Hết hàng' },
        ],
        gallery_images: ['https://img.alicdn.com/g1.jpg'],
      },
      'https://vipomall.vn/san-pham/1?platform_type=10',
      '1',
      10
    )
    const colors = pd.colors as { name: string }[]
    assert.deepEqual(
      colors.map((c) => c.name),
      ['Đỏ', 'Xanh']
    )
    assert.deepEqual(pd.sizes, ['M'])
  })
})

describe('pandamallRowToProductData (188 product_data)', () => {
  it('uses layout_mode color_only and cartesian color×size when both exist', () => {
    const bag = pandamallRowToProductData(
      {
        title: 'Túi',
        layout_mode: 'color_only',
        colors: [{ label: 'Be', image_url: 'https://img.alicdn.com/be.jpg', in_stock: true, stock: 2 }],
        variant_rows: [{ color: 'Be', size: '', in_stock: true, stock: 2, price_vnd: 250000 }],
        gallery_images: ['https://img.alicdn.com/g.jpg'],
      },
      'https://pandamall.vn/1688/detail/99',
      '99',
      '1688'
    )
    assert.equal(bag.product_id, 'A99')
    assert.deepEqual(bag.sizes, [])
    assert.equal(bag.shop_name_chinese, null)
    assert.equal(bag.link_default, 'https://detail.1688.com/offer/99.html')

    const apparel = pandamallRowToProductData(
      {
        title: 'Áo',
        layout_mode: 'color_size',
        colors: [{ label: 'Đen', image_url: 'https://img.alicdn.com/black.jpg', in_stock: true }],
        sizes: ['S', 'M'],
        variant_rows: [
          { color: 'Đen', size: 'S', in_stock: true, stock: 1, price_vnd: 120000 },
          { color: 'Đen', size: 'M', in_stock: true, stock: 1, price_vnd: 120000 },
        ],
        gallery_images: ['https://img.alicdn.com/g.jpg'],
      },
      'https://pandamall.vn/taobao/detail/123',
      '123',
      'taobao'
    )
    assert.equal(apparel.product_id, 'T123')
    assert.deepEqual(apparel.sizes, ['S', 'M'])
    const pairs = ((apparel.product_info as Record<string, unknown>).variants as Record<string, unknown>)
      .pairs as { color: string; size: string }[]
    assert.deepEqual(pairs, [
      { color: 'Đen', size: 'S' },
      { color: 'Đen', size: 'M' },
    ])
  })
})

describe('listing import body specs (188 1688 payload)', () => {
  const thongSo = `Thông số sản phẩm
适用人群:
青年,中年,中青年
材质成分:
涤纶（聚酯纤维）:100%
货号:
45471
风格:
小香风
产地:
广州
限售价格不能低于：349元
Đóng
Nền tảng mua hàng`

  it('parses CJK attribute table + 货号 like 188 _extract_body_specs', () => {
    const pairs = extractCjkAttributePairs(thongSo)
    assert.equal(pairs['货号'], '45471')
    assert.equal(pairs['风格'], '小香风')
    assert.equal(pairs['材质成分'], '涤纶（聚酯纤维）:100%')
    assert.equal(pickCnyPriceFromScrapeRow({ body_text_sample: thongSo }, 773190), '349')
  })

  it('fills Vipomall product_data specs / CNY / material from body_text_sample', () => {
    const pd = vipomallRowToProductData(
      {
        title: 'Trang phục mùa thu năm 2026, váy lụa',
        body_text_sample: thongSo,
        swatch_colors: [{ label: 'màu cà phê', image_url: 'https://img.alicdn.com/c.jpg' }],
        variant_rows: [
          { color: 'màu cà phê', size: 'S', in_stock: true, stock: 9, price_vnd: 773190, stock_text: 'Có sẵn 9 SP' },
        ],
        gallery_images: ['https://img.alicdn.com/g.jpg'],
        detail_images: ['https://img.alicdn.com/d.jpg'],
      },
      'https://vipomall.vn/san-pham/1024630591599?platform_type=10',
      '1024630591599',
      10
    )
    assert.equal(pd.pro_lower_price, '349')
    assert.equal(pd.material, '涤纶（聚酯纤维）:100%')
    assert.equal(pd.style, '小香风')
    const spec = (pd.product_info as Record<string, unknown>).specifications as Record<string, unknown>
    assert.equal(spec['货号'], '45471')
    assert.match(String(pd.description), /货号: 45471/)
  })

  it('strips marketing year from Vietnamese name like 188 year sanitize', () => {
    const pd: Record<string, unknown> = { name: 'Trang phục mùa thu năm 2026, váy lụa' }
    applyListingYearSanitizeToProductData(pd)
    assert.equal(pd.name, 'Trang phục mùa thu, váy lụa')
  })
})

