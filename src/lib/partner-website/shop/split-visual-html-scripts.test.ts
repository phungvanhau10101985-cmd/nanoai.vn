import assert from 'node:assert/strict'
import test from 'node:test'
import { injectShopOrganizationJsonLd } from '@/lib/partner-website/shop/build-shop-visual-seo-head'
import {
  dropScriptsAlreadyEmittedByLiveHead,
  extractVisualHtmlJsonLdBlocks,
  splitVisualHtmlBodyScripts,
  stripVisualHtmlJsonLdScripts,
} from '@/lib/partner-website/shop/split-visual-html-scripts'

test('splitVisualHtmlBodyScripts hoists executable scripts and keeps JSON-LD', () => {
  const body =
    '<main>ok</main><script type="application/ld+json">{"@type":"WebSite"}</script>' +
    '<script defer src="/pw-shop-runtime/catalog.demo-shop.vi.aaa.js" data-pw-catalog-bootstrap></script>' +
    '<script>window.x=1</script>'
  const { markup, scripts } = splitVisualHtmlBodyScripts(body)
  assert.match(markup, /application\/ld\+json/)
  assert.match(markup, /<main>ok<\/main>/)
  assert.doesNotMatch(markup, /window\.x=1/)
  assert.equal(scripts.length, 2)
  assert.equal(scripts[0].src, '/pw-shop-runtime/catalog.demo-shop.vi.aaa.js')
  assert.equal(scripts[0].defer, true)
  assert.equal(scripts[1].body.trim(), 'window.x=1')
})

test('extractVisualHtmlJsonLdBlocks keeps head JSON-LD that body extraction would drop', () => {
  const html =
    '<html><head><script type="application/ld+json">{"@type":"Organization","name":"Gudo"}</script></head>' +
    '<body><main>ok</main><script type="application/ld+json">{"@type":"BreadcrumbList"}</script>' +
    '<script>window.x=1</script></body></html>'
  const blocks = extractVisualHtmlJsonLdBlocks(html)
  assert.equal(blocks.length, 2)
  assert.match(blocks[0], /Organization/)
  assert.match(blocks[1], /BreadcrumbList/)
  assert.doesNotMatch(stripVisualHtmlJsonLdScripts(html), /ld\+json/)
  assert.match(stripVisualHtmlJsonLdScripts(html), /window\.x=1/)
})

test('injectShopOrganizationJsonLd puts phone and url in the head', () => {
  const html = injectShopOrganizationJsonLd('<html><head></head><body></body></html>', {
    name: 'gudo.vn',
    url: 'https://gudo.vn/',
    telephone: '0968659836',
  })
  assert.match(html, /data-pw-seo-jsonld="organization"/)
  assert.match(html, /0968659836/)
  assert.match(html, /https:\/\/gudo\.vn\//)
  const again = injectShopOrganizationJsonLd(html, {
    name: 'gudo.vn',
    url: 'https://gudo.vn/',
    telephone: '0900000000',
  })
  assert.equal(again.match(/data-pw-seo-jsonld="organization"/g)?.length, 1)
  assert.match(again, /0900000000/)
  assert.doesNotMatch(again, /0968659836/)
})

test('dropScriptsAlreadyEmittedByLiveHead keeps bootstrap scripts and drops the head copies', () => {
  const kept = dropScriptsAlreadyEmittedByLiveHead([
    { src: '', defer: false, async: false, id: 'pw-shop-scene-center', type: '', body: 'apply()', dataAttrs: [] },
    { src: '', defer: false, async: false, id: 'pw-shop-listing-head', type: '', body: 'boot()', dataAttrs: [] },
    { src: '', defer: false, async: false, id: 'pw-shop-chrome-float', type: '', body: 'float()', dataAttrs: [] },
    { src: '/nav.js', defer: true, async: false, id: '', type: '', body: '', dataAttrs: [] },
  ])
  assert.deepEqual(
    kept.map((script) => script.id || script.src),
    ['pw-shop-chrome-float', '/nav.js']
  )
})
