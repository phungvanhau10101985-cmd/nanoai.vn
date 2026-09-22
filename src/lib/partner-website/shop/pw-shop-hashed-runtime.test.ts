import assert from 'node:assert/strict'
import test from 'node:test'
import {
  expandPartnerShopHashedRuntimesForTest,
  hashPartnerShopRuntimeBody,
  parsePartnerShopRuntimeFileName,
  rebuildPartnerShopRuntimeJs,
  replaceInlineShopRuntimesWithHashedFiles,
} from '@/lib/partner-website/shop/pw-shop-hashed-runtime'

test('hashed runtime filename round-trips slug locale and hash', () => {
  const parsed = parsePartnerShopRuntimeFileName(
    'catalog.demo-shop.vi.abcdef123456.js'
  )
  assert.equal(parsed?.name, 'catalog')
  assert.equal(parsed?.siteSlug, 'demo-shop')
  assert.equal(parsed?.locale, 'vi')
  assert.equal(parsed?.hash, 'abcdef123456')
  assert.equal(parsePartnerShopRuntimeFileName('nope.js'), null)
})

test('replaceInlineShopRuntimesWithHashedFiles swaps catalog body for defer src', () => {
  const body = rebuildPartnerShopRuntimeJs('catalog', 'demo-shop', 'vi') || ''
  assert.match(body, /function catalogAlreadySeeded/)
  const hash = hashPartnerShopRuntimeBody(body)
  const html =
    `<html><body><script data-pw-catalog-bootstrap>${body}</script></body></html>`
  const hashed = replaceInlineShopRuntimesWithHashedFiles(html, {
    siteSlug: 'demo-shop',
    locale: 'vi',
  })
  assert.match(
    hashed,
    new RegExp(`src="/pw-shop-runtime/catalog\\.demo-shop\\.vi\\.${hash}\\.js"`)
  )
  assert.doesNotMatch(hashed, /function catalogAlreadySeeded/)
  const expanded = expandPartnerShopHashedRuntimesForTest(hashed)
  assert.match(expanded, /function catalogAlreadySeeded/)
})
