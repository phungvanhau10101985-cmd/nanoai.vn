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
  buildImportRatingContextText,
  buildPartnerRatingGroupCatalog,
  emptyPartnerRatingGroupCatalog,
  extractImportGroupIdsFromModelText,
  familyFallbackRatingGroupId,
  RATING_GROUP_ID_UNASSIGNED,
} from '@/lib/messaging/listing-import/listing-import-rating-groups'
import { appendListingImportColorSuffixToViName } from '@/lib/messaging/listing-import/listing-import-taxonomy'
import { compactListingImportProductInfoForWeb } from '@/lib/messaging/listing-import/listing-import-product-info-compact'
import { excelExportRowFromProductData } from '@/lib/messaging/listing-import/import-1688-excel-export-preview'

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
  const shopCatalog = buildPartnerRatingGroupCatalog(
    [12, 20, 31],
    [
      { ratingGroupId: 12, categoryL1: 'Túi xách Nữ', categoryL2: 'Túi xách', categoryL3: 'túi xách nữ', productCount: 10 },
      { ratingGroupId: 20, categoryL1: 'Thời trang Nam', categoryL2: 'Áo thun', categoryL3: 'áo thun nam', productCount: 8 },
      { ratingGroupId: 31, categoryL1: 'Thời trang Nữ', categoryL2: 'Đầm', categoryL3: 'đầm suông nữ midi', productCount: 4 },
    ],
    [88, 99, 100]
  )

  it('maps from this shop catalog, not a global 188 table', () => {
    assert.equal(inferRatingGroupIdFromText('túi xách nữ da bò', shopCatalog.phrases, shopCatalog.genericPhrases), 12)
    assert.equal(inferRatingGroupIdFromText('áo thun nam cotton', shopCatalog.phrases, shopCatalog.genericPhrases), 20)
    assert.equal(inferRatingGroupIdFromText('túi xách nữ da bò'), 0)
    assert.equal(inferRatingGroupIdFromText('váy đầm liền thân dự tiệc nữ', shopCatalog.phrases, shopCatalog.genericPhrases), 0)
  })
  it('maps question group from product name', () => {
    assert.equal(inferQuestionGroupIdFromProductName('Áo thun nam nữ'), 99)
    assert.equal(inferQuestionGroupIdFromProductName('Áo thun nam'), 100)
    assert.equal(inferQuestionGroupIdFromProductName('Váy đầm nữ'), 88)
  })
  it('assigns 888 when shop has no rating catalog', async () => {
    const pd: Record<string, unknown> = { name: 'túi xách nữ da bò' }
    const warnings: string[] = []
    await applyListingImportRatingGroups(pd, warnings, { catalog: emptyPartnerRatingGroupCatalog() })
    assert.equal(pd.group_rating, RATING_GROUP_ID_UNASSIGNED)
    assert.equal(pd.group_question, 88)
  })
  it('maps question group 88 from Vietnamese name with nữ like 188', () => {
    assert.equal(inferQuestionGroupIdFromProductName('Đầm nữ dáng suông xếp ly nhẹ thanh lịch — Đỏ chà là'), 88)
  })
  it('builds rating context from taxonomy JSON features weight and audience like 188', () => {
    const ctx = buildImportRatingContextText({
      name: 'Váy đầm liền thân nữ suông',
      category: 'Thời trang Nữ',
      subcategory: 'Đầm',
      sub_subcategory: 'đầm suông nữ midi',
      features: 'xếp ly nhẹ',
      weight: '280g',
      product_info: {
        product_info: {
          category: { level_1: 'Thời trang Nữ', level_2: 'Đầm', level_3: 'đầm suông nữ midi' },
          target_audience_suggestion_vi: 'Phù hợp Nữ 18–35',
        },
        import_taxonomy_meta: { khach_hang_vi: 'Nữ 18-35' },
      },
    })
    assert.match(ctx, /xếp ly nhẹ/)
    assert.match(ctx, /280g/)
    assert.match(ctx, /Phù hợp Nữ 18–35/)
    assert.match(ctx, /Nữ 18-35/)
    assert.equal(inferRatingGroupIdFromText(ctx, shopCatalog.phrases, shopCatalog.genericPhrases), 31)
  })
  it('keeps 888/0 without AI when taxonomy just created levels', async () => {
    const pd: Record<string, unknown> = {
      name: 'Đầm nữ dáng suông',
      category: 'Thời trang Nữ',
      subcategory: 'Đầm',
      sub_subcategory: 'đầm suông nữ midi',
      _taxonomy_auto_created_levels: '2,3',
    }
    const warnings: string[] = []
    await applyListingImportRatingGroups(pd, warnings, { catalog: shopCatalog })
    assert.equal(pd.group_rating, RATING_GROUP_ID_UNASSIGNED)
    assert.equal(pd.group_question, 0)
    assert.match(String(warnings[0] || ''), /taxonomy vừa tạo/)
  })
  it('only assigns groups that exist in this shop catalog', async () => {
    const hit: Record<string, unknown> = { name: 'Túi xách nữ da bò' }
    await applyListingImportRatingGroups(hit, [], { catalog: shopCatalog })
    assert.equal(hit.group_rating, 12)
    const otherShop = buildPartnerRatingGroupCatalog(
      [40],
      [{ ratingGroupId: 40, categoryL1: 'Thời trang Nữ', categoryL2: 'Đầm', categoryL3: 'váy đầm liền thân dự tiệc nữ' }]
    )
    const miss: Record<string, unknown> = { name: 'Túi xách nữ da bò' }
    await applyListingImportRatingGroups(miss, [], { catalog: otherShop })
    assert.equal(miss.group_rating, RATING_GROUP_ID_UNASSIGNED)
    const empty: Record<string, unknown> = { name: 'Túi xách nữ da bò' }
    await applyListingImportRatingGroups(empty, [], { catalog: emptyPartnerRatingGroupCatalog() })
    assert.equal(empty.group_rating, RATING_GROUP_ID_UNASSIGNED)
  })
  it('when the same L3 is in two imported groups, prefers the group with more products', () => {
    const catalog = buildPartnerRatingGroupCatalog(
      [27, 36],
      [
        { ratingGroupId: 27, categoryL1: 'Giày dép Nữ', categoryL2: 'Sneaker', categoryL3: 'sneaker nữ chunky đế dày', productCount: 434 },
        { ratingGroupId: 36, categoryL1: 'Giày dép Nữ', categoryL2: 'Giày thể thao', categoryL3: 'sneaker nữ chunky đế dày', productCount: 352 },
      ]
    )
    assert.equal(
      inferRatingGroupIdFromText(
        'Giày dép Nữ Sneaker sneaker nữ chunky đế dày Giày sneaker nữ',
        catalog.phrases,
        catalog.genericPhrases,
        catalog.groupIds
      ),
      27
    )
  })
  it('deboosts L1 shared by two groups in the same shop', () => {
    const catalog = buildPartnerRatingGroupCatalog(
      [18, 21],
      [
        { ratingGroupId: 18, categoryL1: 'Giày dép Nam', categoryL2: 'Sneaker', categoryL3: 'giày sneaker nam' },
        { ratingGroupId: 21, categoryL1: 'Giày dép Nam', categoryL2: 'Giày lười', categoryL3: 'giày lười nam' },
      ]
    )
    assert.equal(
      inferRatingGroupIdFromText('giày sneaker nam da bò giày dép nam', catalog.phrases, catalog.genericPhrases),
      18
    )
  })
  it('uses family fallback like 188 only for groups this shop already imported', () => {
    const dressCatalog = buildPartnerRatingGroupCatalog(
      [6, 40, 54, 59, 85],
      [
        { ratingGroupId: 6, categoryL1: 'Thời trang Nữ', categoryL2: 'Đầm', categoryL3: 'váy đầm maxi nữ', productCount: 3 },
        { ratingGroupId: 40, categoryL1: 'Thời trang Nữ', categoryL2: 'Đầm', categoryL3: 'váy đầm liền thân dự tiệc nữ', productCount: 2 },
        { ratingGroupId: 54, categoryL1: 'Thời trang Nữ', categoryL2: 'Chân váy', categoryL3: 'chân váy nữ', productCount: 2 },
        { ratingGroupId: 59, categoryL1: 'Thời trang Nữ', categoryL2: 'Đầm', categoryL3: 'váy đầm liền thân nữ', productCount: 8 },
        { ratingGroupId: 85, categoryL1: 'Thời trang Nữ', categoryL2: 'Áo', categoryL3: 'áo hai dây nữ', productCount: 1 },
      ],
      [88]
    )
    assert.equal(
      inferRatingGroupIdFromText('đầm ôm body nữ', dressCatalog.phrases, dressCatalog.genericPhrases, dressCatalog.groupIds),
      59
    )
    assert.equal(
      inferRatingGroupIdFromText('đầm maxi nữ dáng dài', dressCatalog.phrases, dressCatalog.genericPhrases, dressCatalog.groupIds),
      6
    )
    assert.equal(familyFallbackRatingGroupId('đầm ôm body nữ', []), 0)
    assert.equal(familyFallbackRatingGroupId('đầm ôm body nữ', dressCatalog.groupIds), 59)
  })
  it('keeps question groups from this shop import pool like 188', async () => {
    assert.deepEqual(shopCatalog.questionGroupIds, [88, 99, 100])
    const pd: Record<string, unknown> = { name: 'Túi xách nữ da bò' }
    await applyListingImportRatingGroups(pd, [], { catalog: shopCatalog })
    assert.equal(pd.group_question, 88)
    const maleOnly = buildPartnerRatingGroupCatalog(
      [20],
      [{ ratingGroupId: 20, categoryL1: 'Thời trang Nam', categoryL2: 'Áo thun', categoryL3: 'áo thun nam' }],
      [100]
    )
    const missQ: Record<string, unknown> = { name: 'Váy đầm nữ' }
    await applyListingImportRatingGroups(missQ, [], { catalog: maleOnly })
    assert.equal(missQ.group_question, 0)
  })
  it('extracts group ids from loose model text like 188', () => {
    const parsed = extractImportGroupIdsFromModelText(
      'rating_group_id: 12\nquestion_group_id: 88',
      shopCatalog
    )
    assert.equal(parsed.rating, 12)
    assert.equal(parsed.question, 88)
    const miss = extractImportGroupIdsFromModelText('rating_group_id: 59\nquestion_group_id: 77', shopCatalog)
    assert.equal(miss.rating, null)
    assert.equal(miss.question, null)
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
    assert.equal(pd.material, null)
    assert.equal(pd.style, null)
    const spec = (pd.product_info as Record<string, unknown>).specifications as Record<string, unknown>
    assert.equal(spec['货号'], '45471')
    assert.match(String(pd.description), /货号: 45471/)
  })

  it('maps Vietnamese Thông số sản phẩm to style/material/occasion/features', () => {
    const thongSoVi = `Thông số sản phẩm
Phong cách:
Thư giãn
Mã hàng:
Z9839
Chất liệu mặt giày:
Siêu sợi
Chức năng:
Tăng chiều cao,Nhẹ nhàng,Chống mài mòn
Các tình huống sử dụng:
Thư giãn
Kích cỡ:
34,35,36
Đóng
Nền tảng mua hàng`
    const pairs = extractCjkAttributePairs(thongSoVi)
    assert.equal(pairs['Mã hàng'], 'Z9839')
    assert.equal(pairs['Phong cách'], 'Thư giãn')
    assert.equal(pairs['Chất liệu mặt giày'], 'Siêu sợi')
    const pd = vipomallRowToProductData(
      {
        title: 'Giày dad nữ đế dày',
        body_text_sample: thongSoVi,
        swatch_colors: [{ label: 'Màu champagne', image_url: 'https://img.alicdn.com/c.jpg' }],
        sizes: ['34', '35'],
        gallery_images: ['https://img.alicdn.com/g.jpg'],
        detail_images: ['https://img.alicdn.com/d.jpg'],
      },
      'https://vipomall.vn/san-pham/1077421901676?platform_type=10',
      '1077421901676',
      10
    )
    assert.equal(pd.style, 'Thư giãn')
    assert.equal(pd.material, 'Siêu sợi')
    assert.equal(pd.occasion, 'Thư giãn')
    assert.deepEqual(pd.features, ['Tăng chiều cao', 'Nhẹ nhàng', 'Chống mài mòn'])
    assert.equal(pd.code, '')
    const inner = (pd.product_info as Record<string, unknown>).product_info as Record<string, unknown>
    assert.equal(inner.article_no, 'Z9839')
    assert.match(String(pd.description), /Mã hàng: Z9839/)
  })

  it('strips marketing year from Vietnamese name like 188 year sanitize', () => {
    const pd: Record<string, unknown> = { name: 'Trang phục mùa thu năm 2026, váy lụa' }
    applyListingYearSanitizeToProductData(pd)
    assert.equal(pd.name, 'Trang phục mùa thu, váy lụa')
  })
})

describe('listing import Excel / product_info parity with 188', () => {
  it('appends up to 4 color labels to Vietnamese name', () => {
    assert.equal(
      appendListingImportColorSuffixToViName('Đầm nữ dáng suông', ['Đỏ chà là']),
      'Đầm nữ dáng suông — Đỏ chà là'
    )
    assert.equal(
      appendListingImportColorSuffixToViName('Áo', ['A', 'B', 'C', 'D', 'E']),
      'Áo — A, B, C, D'
    )
  })

  it('blanks origin/brand/shop columns like 188 _excel_row_from_product', () => {
    const row = excelExportRowFromProductData({
      product_id: 'A1',
      name: 'Đầm nữ',
      origin: '1688',
      brand_name: '其他',
      shop_name: 'Vipomall',
      shop_id: '123',
      pro_lower_price: '128,00',
      pro_high_price: '128,00',
      description: 'Mô tả bán',
      sizes: ['S', 'XXL'],
      group_rating: 888,
      group_question: 88,
    })
    assert.equal(row.origin, '')
    assert.equal(row.brand, '')
    assert.equal(row.shop_name, '')
    assert.equal(row.shop_id, '')
    assert.equal(row.pro_lower_price, '')
    assert.equal(row.pro_high_price, '')
    assert.equal(row.pro_content, 'Mô tả bán')
    assert.equal(row.sizes, '["S", "XXL"]')
    assert.equal(row.question_group_id, 88)
  })

  it('compacts product_info to web keys like 188 compact_product_info_for_web', () => {
    const pd: Record<string, unknown> = {
      product_info: {
        product_info: {
          name: 'Đầm nữ — Đỏ',
          name_vi: 'Đầm nữ',
          display_name_vi: 'Đầm nữ — Đỏ',
          target_audience_suggestion_vi: 'Phù hợp Nữ 18–35',
          listing_sku_hint: 'A1',
        },
        specifications: {
          style: 'Thanh lịch',
          occasion: 'Đi làm, dạo phố',
          thong_so_kich_thuoc_vi: 'Dáng suông',
          supplier_specs_excerpt: '材质:涤纶',
          货号: '45471',
        },
        variants: {
          source: 'vipomall',
          colors: 'Đỏ chà là',
          sizes: 'S, XXL',
          pairs: [{ color: 'Đỏ', size: 'S' }],
          vipomall_rows: [{ x: 1 }],
        },
        market_info: { currency: 'VND', note: 'scrape' },
      },
    }
    compactListingImportProductInfoForWeb(pd)
    const pi = pd.product_info as Record<string, unknown>
    const inner = pi.product_info as Record<string, unknown>
    const spec = pi.specifications as Record<string, unknown>
    const variants = pi.variants as Record<string, unknown>
    assert.equal(inner.name_vi, 'Đầm nữ')
    assert.equal(inner.display_name_vi, 'Đầm nữ — Đỏ')
    assert.equal(spec.style, 'Thanh lịch')
    assert.equal(spec.occasion, 'Đi làm, dạo phố')
    assert.equal(spec['货号'], undefined)
    assert.equal(spec.supplier_specs_excerpt, undefined)
    assert.equal(variants.colors, 'Đỏ chà là')
    assert.equal(variants.sizes, 'S, XXL')
    assert.equal(variants.source, undefined)
    assert.equal(variants.pairs, undefined)
    assert.equal(pi.market_info, undefined)
  })
})

