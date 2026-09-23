import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dropScriptsAlreadyEmittedByLiveHead,
  splitVisualHtmlBodyScripts,
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
