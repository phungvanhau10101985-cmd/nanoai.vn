import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applySloganInHtml,
  bindPartnerShopSloganInHtml,
  ensureSloganNodesInHtml,
  extractSloganFromHtml,
  sanitizePartnerShopSlogan,
} from '@/lib/partner-website/shop/partner-site-shop-slogan'
import { parsePartnerShopSloganAiJson } from '@/lib/partner-website/shop/partner-site-shop-slogan-ai'

const SAMPLE = `<html><body>
<div class="pw-topbar"><div class="pw-container pw-topbar-inner">
  <a data-pw-el="link">Liên hệ</a>
</div></div>
<footer class="pw-footer">
  <p class="pw-shop-footer-hint">Mua sắm trực tuyến — sản phẩm đúng mô tả, giao hàng toàn quốc.</p>
</footer>
</body></html>`

test('sanitize strips tags and caps length', () => {
  assert.equal(sanitizePartnerShopSlogan('  <b>Chất lượng thật</b>  '), 'Chất lượng thật')
  assert.equal(sanitizePartnerShopSlogan('x'.repeat(120)).length, 80)
})

test('ensure + apply fills topbar and footer slogan', () => {
  const next = applySloganInHtml(SAMPLE, 'Thời trang đúng chất', {
    footerSeed: 'Mua sắm trực tuyến — sản phẩm đúng mô tả, giao hàng toàn quốc.',
  })
  assert.match(next, /data-pw-el="slogan"/)
  assert.match(next, /class="pw-slogan"/)
  assert.equal((next.match(/Thời trang đúng chất/g) || []).length, 2)
  assert.equal(extractSloganFromHtml(next), 'Thời trang đúng chất')
})

test('empty slogan hides topbar and restores footer seed', () => {
  const filled = applySloganInHtml(SAMPLE, 'Túi xách mỗi ngày', {
    footerSeed: 'Mua sắm trực tuyến — sản phẩm đúng mô tả, giao hàng toàn quốc.',
  })
  const cleared = applySloganInHtml(filled, '', {
    footerSeed: 'Mua sắm trực tuyến — sản phẩm đúng mô tả, giao hàng toàn quốc.',
  })
  assert.match(cleared, /<span[^>]*class="pw-slogan"[^>]*\bhidden\b/)
  assert.match(cleared, /pw-shop-footer-hint[^>]*>Mua sắm trực tuyến/)
  assert.equal(extractSloganFromHtml(cleared), '')
})

test('ensure is idempotent when nodes already exist', () => {
  const once = ensureSloganNodesInHtml(SAMPLE, {
    footerSeed: 'Mua sắm trực tuyến — sản phẩm đúng mô tả, giao hàng toàn quốc.',
  })
  const twice = ensureSloganNodesInHtml(once, {
    footerSeed: 'Mua sắm trực tuyến — sản phẩm đúng mô tả, giao hàng toàn quốc.',
  })
  assert.equal(twice, once)
  assert.equal((once.match(/class="pw-slogan"/g) || []).length, 1)
})

test('ensure still adds topbar slogan when footer already has one', () => {
  const html = `<html><body>
<div class="pw-topbar"><div class="pw-topbar-inner"><a data-pw-el="link">Liên hệ</a></div></div>
<footer><p class="pw-shop-footer-hint" data-pw-el="slogan" data-pw-slogan="1" data-pw-seed-slogan="Mua sắm trực tuyến">Mua sắm trực tuyến</p></footer>
</body></html>`
  const next = ensureSloganNodesInHtml(html, { footerSeed: 'Mua sắm trực tuyến' })
  assert.match(next, /<span[^>]*class="pw-slogan"/)
  assert.equal((next.match(/data-pw-el="slogan"/g) || []).length, 2)
})

test('apply keeps Sửa nhanh hide on slogan nodes', () => {
  const html = `<html><body>
<div class="pw-topbar-inner"><span class="pw-slogan" data-pw-el="slogan" data-pw-slogan="1" data-pw-hidden="1"></span></div>
<p class="pw-shop-footer-hint" data-pw-el="slogan" data-pw-slogan="1" data-pw-seed-slogan="Seed">Seed</p>
</body></html>`
  const next = applySloganInHtml(html, 'Túi xách mỗi ngày')
  assert.match(next, /class="pw-slogan"[^>]*data-pw-hidden="1"[^>]*\bhidden\b/)
  assert.match(next, /pw-shop-footer-hint[^>]*>Túi xách mỗi ngày/)
})

test('bind reads slogan from theme', () => {
  const next = bindPartnerShopSloganInHtml(SAMPLE, { slogan: 'Giày đẹp mỗi bước' }, 'vi')
  assert.match(next, /Giày đẹp mỗi bước/)
})

test('AI JSON parser keeps unique slogans', () => {
  const parsed = parsePartnerShopSloganAiJson(
    '{"slogan":"Túi xách chuẩn gu","alternatives":["Túi xách chuẩn gu","Phong cách mỗi ngày","x"]}'
  )
  assert.equal(parsed?.slogan, 'Túi xách chuẩn gu')
  assert.deepEqual(parsed?.alternatives, ['Phong cách mỗi ngày', 'x'])
})
