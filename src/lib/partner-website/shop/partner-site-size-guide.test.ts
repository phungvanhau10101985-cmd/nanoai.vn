import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PARTNER_SIZE_GUIDE_INDEX_KINDS,
  PARTNER_SIZE_GUIDE_KINDS,
  PARTNER_SIZE_GUIDE_L2_KINDS,
  SIZE_GUIDE_APPAREL_FEMALE_ROWS,
  SIZE_GUIDE_APPAREL_MALE_ROWS,
  SIZE_GUIDE_BOXER_MALE_ROWS,
  SIZE_GUIDE_BRA_BAND_ROWS,
  SIZE_GUIDE_KIDS_APPAREL_ROWS,
  SIZE_GUIDE_SHOE_FEMALE_ROWS,
  SIZE_GUIDE_SHOE_KID_ROWS,
  SIZE_GUIDE_SHOE_MALE_ROWS,
  parsePartnerSizeGuideKind,
  partnerHasProductSizes,
  resolvePartnerSizeGuideKind,
  sanitizePartnerSizeGuideImageUrl,
} from '@/lib/partner-website/shop/partner-site-size-guide'
import {
  buildPartnerSizeGuideHostHtml,
  ensurePartnerPdpSizeGuideModalInHtml,
  ensurePartnerSizeGuideInHtml,
  partnerSiteSizeGuideHref,
  stripPartnerSizeGuideFromHtml,
} from '@/lib/partner-website/shop/partner-site-size-guide-html'

test('size guide kinds match 188 cat1 + cat2 charts for products with sizes', () => {
  assert.deepEqual([...PARTNER_SIZE_GUIDE_INDEX_KINDS], [
    'giay-dep-nam',
    'giay-dep-nu',
    'thoi-trang-nam',
    'thoi-trang-nu',
    'do-lot-nam',
    'do-lot-nu',
    'trang-phuc-bau-hau-san',
    'thoi-trang-tre-em',
    'the-thao-da-ngoai',
  ])
  assert.deepEqual([...PARTNER_SIZE_GUIDE_L2_KINDS], [
    'thoi-trang-tre-em/giay-dep-tre-em',
    'do-lot-nam/quan-lot-boxer-brief-nam',
    'do-lot-nu/bra-ao-nguc-nu',
    'giay-dep-nu/giay-cao-got-nu',
    'giay-dep-nu/giay-cuoi-du-tiec-nu',
  ])
  assert.equal(PARTNER_SIZE_GUIDE_KINDS.length, 14)
  assert.equal(parsePartnerSizeGuideKind('giay-nam'), 'giay-dep-nam')
  assert.equal(parsePartnerSizeGuideKind('quan-ao-nu'), 'thoi-trang-nu')
  assert.equal(parsePartnerSizeGuideKind('giay-dep-tre-em'), 'thoi-trang-tre-em/giay-dep-tre-em')
  assert.equal(parsePartnerSizeGuideKind('quan-lot-boxer-brief-nam'), 'do-lot-nam/quan-lot-boxer-brief-nam')
  assert.equal(parsePartnerSizeGuideKind('bra-ao-nguc-nu'), 'do-lot-nu/bra-ao-nguc-nu')
  assert.equal(parsePartnerSizeGuideKind('tui-xach-nu'), null)
})

test('188 shoe and apparel charts keep the same rows', () => {
  assert.equal(SIZE_GUIDE_SHOE_MALE_ROWS[0][1], '38')
  assert.equal(SIZE_GUIDE_SHOE_MALE_ROWS.at(-1)?.[1], '47')
  assert.equal(SIZE_GUIDE_SHOE_FEMALE_ROWS[0][1], '34')
  assert.equal(SIZE_GUIDE_SHOE_FEMALE_ROWS.at(-1)?.[1], '43')
  assert.equal(SIZE_GUIDE_APPAREL_MALE_ROWS[0][0], 'S')
  assert.equal(SIZE_GUIDE_APPAREL_MALE_ROWS.at(-1)?.[0], '5XL')
  assert.equal(SIZE_GUIDE_APPAREL_FEMALE_ROWS[0][0], 'XS')
  assert.equal(SIZE_GUIDE_APPAREL_FEMALE_ROWS.at(-1)?.[0], '3XL')
  assert.equal(SIZE_GUIDE_SHOE_KID_ROWS[0][1], '24')
  assert.equal(SIZE_GUIDE_SHOE_KID_ROWS.at(-1)?.[1], '37–38')
  assert.equal(SIZE_GUIDE_BRA_BAND_ROWS[0][1], '65')
  assert.equal(SIZE_GUIDE_BRA_BAND_ROWS.at(-1)?.[1], '90')
  assert.equal(SIZE_GUIDE_KIDS_APPAREL_ROWS[0][0], '12–18 tháng')
  assert.equal(SIZE_GUIDE_BOXER_MALE_ROWS[0][0], 'S')
  assert.equal(SIZE_GUIDE_BOXER_MALE_ROWS[0][1], '70–76')
  assert.equal(SIZE_GUIDE_BOXER_MALE_ROWS.at(-1)?.[0], '3XL')
  assert.equal(SIZE_GUIDE_BOXER_MALE_ROWS.at(-1)?.[1], '100–108')
})

test('resolve kind from 188 category names and paths', () => {
  assert.equal(resolvePartnerSizeGuideKind({ categoryL1: 'Giày dép Nam' }), 'giay-dep-nam')
  assert.equal(resolvePartnerSizeGuideKind({ categoryL1: 'Giày dép Nữ' }), 'giay-dep-nu')
  assert.equal(resolvePartnerSizeGuideKind({ categoryL1: 'Thời trang Nam' }), 'thoi-trang-nam')
  assert.equal(resolvePartnerSizeGuideKind({ categoryL1: 'Thời trang Nữ' }), 'thoi-trang-nu')
  assert.equal(
    resolvePartnerSizeGuideKind({ categoryPath: 'thoi-trang-nu/dam-vay' }),
    'thoi-trang-nu'
  )
  assert.equal(resolvePartnerSizeGuideKind({ categoryL1: 'Túi xách Nữ', name: 'Túi mini' }), null)
  assert.equal(resolvePartnerSizeGuideKind({ name: 'Giày sneaker nam da' }), 'giay-dep-nam')
  assert.equal(resolvePartnerSizeGuideKind({ name: 'Đầm maxi nữ' }), 'thoi-trang-nu')
  assert.equal(resolvePartnerSizeGuideKind({ categoryL1: 'Thời trang trẻ em' }), 'thoi-trang-tre-em')
  assert.equal(
    resolvePartnerSizeGuideKind({
      categoryPath: 'thoi-trang-tre-em/giay-dep-tre-em',
      name: 'Giày thể thao bé trai',
    }),
    'thoi-trang-tre-em/giay-dep-tre-em'
  )
  assert.equal(resolvePartnerSizeGuideKind({ categoryL1: 'Đồ lót Nữ', categoryL2: 'Bra áo ngực Nữ' }), 'do-lot-nu/bra-ao-nguc-nu')
  assert.equal(resolvePartnerSizeGuideKind({ name: 'Áo ngực ren cup B' }), 'do-lot-nu/bra-ao-nguc-nu')
  assert.equal(resolvePartnerSizeGuideKind({ categoryL1: 'Đồ lót Nam' }), 'do-lot-nam')
  assert.equal(
    resolvePartnerSizeGuideKind({ categoryL1: 'Đồ lót Nam', categoryL2: 'Quần lót boxer brief Nam' }),
    'do-lot-nam/quan-lot-boxer-brief-nam'
  )
  assert.equal(resolvePartnerSizeGuideKind({ name: 'Quần lót boxer nam cotton' }), 'do-lot-nam/quan-lot-boxer-brief-nam')
  assert.equal(resolvePartnerSizeGuideKind({ categoryL1: 'Trang phục bầu & hậu sản' }), 'trang-phuc-bau-hau-san')
  assert.equal(resolvePartnerSizeGuideKind({ categoryL1: 'Thể thao & dã ngoại' }), 'the-thao-da-ngoai')
  assert.equal(
    resolvePartnerSizeGuideKind({ categoryL1: 'Giày dép Nữ', categoryL2: 'Giày cao gót Nữ' }),
    'giay-dep-nu/giay-cao-got-nu'
  )
  assert.equal(resolvePartnerSizeGuideKind({ name: 'Giày cưới nữ gót nhọn' }), 'giay-dep-nu/giay-cuoi-du-tiec-nu')
})

test('only products with sizes are flagged', () => {
  assert.equal(partnerHasProductSizes(['M', 'L']), true)
  assert.equal(partnerHasProductSizes([]), false)
  assert.equal(partnerHasProductSizes(['', '  ']), false)
})

test('index HTML lists L1 + L2 groups; kind HTML has matching table', () => {
  const index = buildPartnerSizeGuideHostHtml({ locale: 'vi', siteSlug: 'demo-shop' })
  assert.match(index, /data-pw-size-guide="index"/)
  assert.match(index, /Giày dép Nam/)
  assert.match(index, /Giày dép Nữ/)
  assert.match(index, /Thời trang Nam/)
  assert.match(index, /Thời trang Nữ/)
  assert.match(index, /Thời trang trẻ em/)
  assert.match(index, /Đồ lót Nữ/)
  assert.match(index, /Bra áo ngực Nữ/)
  assert.match(index, /Quần lót boxer Nam/)
  assert.match(index, /Giày dép trẻ em/)
  assert.match(index, /\/site\/demo-shop\/size-guide\/do-lot-nam\/quan-lot-boxer-brief-nam/)
  assert.match(index, /Nhóm con có bảng riêng/)
  assert.match(index, /\/site\/demo-shop\/size-guide\/giay-dep-nam/)
  assert.match(index, /\/site\/demo-shop\/size-guide\/thoi-trang-tre-em\/giay-dep-tre-em/)
  assert.doesNotMatch(index, /Túi xách/)
  const shoes = buildPartnerSizeGuideHostHtml({
    kind: 'giay-dep-nam',
    locale: 'vi',
    siteSlug: 'demo-shop',
    shopName: 'Shop Demo',
  })
  assert.match(shoes, /23,6–24,0/)
  assert.match(shoes, />38</)
  assert.match(shoes, /28,1–28,5/)
  assert.match(shoes, /Shop Demo/)
  const apparel = buildPartnerSizeGuideHostHtml({
    kind: 'thoi-trang-nu',
    locale: 'vi',
    siteSlug: 'demo-shop',
  })
  assert.match(apparel, />XS</)
  assert.match(apparel, /78–82/)
  assert.match(apparel, /Chiều cao \(cm\)/)
  const kids = buildPartnerSizeGuideHostHtml({
    kind: 'thoi-trang-tre-em',
    locale: 'vi',
    siteSlug: 'demo-shop',
  })
  assert.match(kids, /12–18 tháng/)
  assert.match(kids, /92–98/)
  const kidShoes = buildPartnerSizeGuideHostHtml({
    kind: 'thoi-trang-tre-em/giay-dep-tre-em',
    locale: 'vi',
    siteSlug: 'demo-shop',
  })
  assert.match(kidShoes, />15,5</)
  assert.match(kidShoes, />24</)
  const bra = buildPartnerSizeGuideHostHtml({
    kind: 'do-lot-nu/bra-ao-nguc-nu',
    locale: 'vi',
    siteSlug: 'demo-shop',
  })
  assert.match(bra, /63–67/)
  assert.match(bra, />65</)
  assert.match(bra, /75B/)
  const boxer = buildPartnerSizeGuideHostHtml({
    kind: 'do-lot-nam/quan-lot-boxer-brief-nam',
    locale: 'vi',
    siteSlug: 'demo-shop',
  })
  assert.match(boxer, /Cỡ VN/)
  assert.match(boxer, /70–76/)
  assert.match(boxer, /Hông \(cm\)/)
  assert.match(boxer, /không dùng số eo Mỹ 28–38/)
  assert.doesNotMatch(boxer, /<td>28<\/td>/)
  const underwearMale = buildPartnerSizeGuideHostHtml({
    kind: 'do-lot-nam',
    locale: 'vi',
    siteSlug: 'demo-shop',
  })
  assert.match(underwearMale, /Cỡ VN/)
  assert.match(underwearMale, /70–76/)
})

test('ensure injects cards into size-guide visual HTML idempotently', () => {
  const html = `<!DOCTYPE html><html><head><title>Size</title></head>
<body data-pw-page="info">
<article data-pw-info-article="1">
<h1 data-pw-info-title="1">Hướng dẫn chọn size</h1>
<div data-pw-info-body="1"><p>Đo ngực / eo.</p></div>
</article>
</body></html>`
  const once = ensurePartnerSizeGuideInHtml(html, {
    locale: 'vi',
    siteSlug: 'demo-shop',
    pageKey: 'size_guide',
  })
  const twice = ensurePartnerSizeGuideInHtml(once, {
    locale: 'vi',
    siteSlug: 'demo-shop',
    pageKey: 'size_guide',
  })
  assert.equal((twice.match(/data-pw-size-guide="index"/g) || []).length, 1)
  assert.match(twice, /Giày dép Nam/)
  assert.match(twice, /Thời trang trẻ em/)
  assert.match(twice, /data-pw-size-guide-css/)
  const stripped = stripPartnerSizeGuideFromHtml(twice)
  assert.doesNotMatch(stripped, /data-pw-size-guide="index"/)
  assert.match(stripped, /Đo ngực/)
})

test('PDP modal is only injected when the product has sizes', () => {
  const html = `<!DOCTYPE html><html><head></head><body data-pw-page="product"></body></html>`
  const withSizes = ensurePartnerPdpSizeGuideModalInHtml(html, {
    locale: 'vi',
    siteSlug: 'demo-shop',
    hasSizes: true,
    kind: 'giay-dep-nam',
    closeLabel: 'Đóng',
    title: 'Size',
  })
  assert.match(withSizes, /data-pw-size-guide-modal/)
  assert.match(withSizes, /23,6–24,0/)
  const bag = ensurePartnerPdpSizeGuideModalInHtml(html, {
    locale: 'vi',
    siteSlug: 'demo-shop',
    hasSizes: false,
    closeLabel: 'Đóng',
    title: 'Size',
  })
  assert.doesNotMatch(bag, /data-pw-size-guide-modal/)
  const leftover = ensurePartnerPdpSizeGuideModalInHtml(html, {
    locale: 'vi',
    siteSlug: 'demo-shop',
    hasSizes: true,
    kind: null,
    closeLabel: 'Đóng',
    title: 'Size',
  })
  assert.doesNotMatch(leftover, /data-pw-size-guide-modal/)
  const kidsModal = ensurePartnerPdpSizeGuideModalInHtml(html, {
    locale: 'vi',
    siteSlug: 'demo-shop',
    hasSizes: true,
    kind: 'thoi-trang-tre-em/giay-dep-tre-em',
    closeLabel: 'Đóng',
    title: 'Size',
  })
  assert.match(kidsModal, /15,5/)
})

test('PDP modal strip is nested-aware so leftover demo size chart does not stay visible', () => {
  const leftoverImg =
    'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/material-1-a3-1786251749-b5707ab23f.jpg'
  const html = `<!DOCTYPE html><html><head></head><body data-pw-page="product">
<main><p>PDP</p></main>
<div class="pw-size-guide-dialog-body">
  <div class="pw-size-guide" data-pw-size-guide="thoi-trang-nu"><h2>Gợi ý cỡ theo chiều cao &amp; cân nặng (nữ)</h2></div>
  <img src="${leftoverImg}" alt="Đầm voan" />
</div>
</div>
</div>
</body></html>`
  const next = ensurePartnerPdpSizeGuideModalInHtml(html, {
    locale: 'vi',
    siteSlug: 'demo-shop',
    hasSizes: true,
    kind: 'thoi-trang-nu',
    closeLabel: 'Đóng',
    title: 'Bảng size',
    imageUrl: leftoverImg,
    leftoverPhotoUrls: [leftoverImg],
  })
  assert.equal((next.match(/<div[^>]*data-pw-size-guide-modal/g) || []).length, 1)
  assert.equal((next.match(/data-pw-size-guide="thoi-trang-nu"/g) || []).length, 1)
  assert.match(next, /data-pw-size-guide-modal[^>]*\bhidden\b/)
  assert.doesNotMatch(next, /material-1-a3-1786251749/)
  const stripped = stripPartnerSizeGuideFromHtml(next)
  assert.doesNotMatch(stripped, /Gợi ý cỡ theo chiều cao/)
  assert.doesNotMatch(stripped, /material-1-a3-1786251749/)
  const twice = ensurePartnerPdpSizeGuideModalInHtml(next, {
    locale: 'vi',
    siteSlug: 'demo-shop',
    hasSizes: true,
    kind: 'thoi-trang-nu',
    closeLabel: 'Đóng',
    title: 'Bảng size',
  })
  assert.equal((twice.match(/<div[^>]*data-pw-size-guide-modal/g) || []).length, 1)
  assert.equal((twice.match(/Gợi ý cỡ theo chiều cao/g) || []).length, 1)
})

test('sanitizePartnerSizeGuideImageUrl drops leftover product photos', () => {
  const material =
    'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/material-1-a3-1786251749-b5707ab23f.jpg'
  assert.equal(sanitizePartnerSizeGuideImageUrl(material, [material]), null)
  assert.equal(
    sanitizePartnerSizeGuideImageUrl('https://cdn.example/size-chart.jpg', [material]),
    'https://cdn.example/size-chart.jpg'
  )
})

test('bags with leftover sizes still do not get a clothing/shoe chart', () => {
  assert.equal(resolvePartnerSizeGuideKind({ categoryL1: 'Túi xách Nam', name: 'Túi da size L' }), null)
})

test('size guide href uses custom domain paths including nested L2', () => {
  assert.equal(partnerSiteSizeGuideHref('demo', 'giay-dep-nu', true), '/size-guide/giay-dep-nu')
  assert.equal(
    partnerSiteSizeGuideHref('demo', 'thoi-trang-tre-em/giay-dep-tre-em', true),
    '/size-guide/thoi-trang-tre-em/giay-dep-tre-em'
  )
  assert.equal(partnerSiteSizeGuideHref('demo', null, false), '/site/demo/size-guide')
})
