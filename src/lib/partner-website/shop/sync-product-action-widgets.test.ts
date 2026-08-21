import assert from 'node:assert/strict'
import test from 'node:test'
import { syncProductActionWidgetsAcrossProjectFiles } from '@/lib/partner-website/shop/sync-product-action-widgets'

test('sync copies card favorite onto catalogs of the same device', () => {
  const widget =
    '<button type="button" data-pw-chrome-btn="favorite-product" data-pw-favorite data-pw-card-favorite="1">♥</button>'
  const source = `<body data-pw-page="home"><section data-pw-region="catalog" data-pw-catalog data-pw-card-favorite="1"><div data-pw-grid><article data-pw-el="card"><a data-pw-el="card-media" href="/p">${widget}<img/></a></article></div></section></body>`
  const other = `<body data-pw-page="listing"><section data-pw-region="catalog" data-pw-catalog><div data-pw-grid><article data-pw-el="card"><a data-pw-el="card-media" href="/p"><img/></a></article></div></section></body>`
  const project = {
    files: [
      { path: 'index.html', kind: 'html', content: source },
      { path: 'products.html', kind: 'html', content: other },
      { path: 'index.mobile.html', kind: 'html', content: other },
    ],
  }
  const next = syncProductActionWidgetsAcrossProjectFiles(project, 'index.html', source)
  const listing = next.files.find((f) => f.path === 'products.html')?.content || ''
  const mobile = next.files.find((f) => f.path === 'index.mobile.html')?.content || ''
  assert.match(listing, /data-pw-card-favorite="1"/)
  assert.match(listing, /data-pw-chrome-btn="favorite-product"/)
  assert.match(listing, /data-pw-card-favorite-tpl/)
  assert.doesNotMatch(mobile, /data-pw-chrome-btn="favorite-product"/)
})

test('sync copies PDP favorite onto other product HTML of the same device', () => {
  const widget =
    '<button type="button" data-pw-chrome-btn="favorite-product" data-pw-favorite data-pw-pdp-favorite="1">♥</button>'
  const idA = '00073cac-1111-2222-3333-444444444444'
  const idB = '11173cac-1111-2222-3333-444444444444'
  const source = `<body data-pw-page="product"><div data-pw-region="pdp-info">${widget}<h1>A</h1></div></body>`
  const other = `<body data-pw-page="product"><div data-pw-region="pdp-info"><h1>B</h1></div></body>`
  const project = {
    files: [
      { path: `p/${idA}.html`, kind: 'html', content: source },
      { path: `p/${idB}.html`, kind: 'html', content: other },
      { path: `p/${idB}.mobile.html`, kind: 'html', content: other },
    ],
  }
  const next = syncProductActionWidgetsAcrossProjectFiles(project, `p/${idA}.html`, source)
  const b = next.files.find((f) => f.path === `p/${idB}.html`)?.content || ''
  const bMobile = next.files.find((f) => f.path === `p/${idB}.mobile.html`)?.content || ''
  assert.match(b, /data-pw-pdp-favorite="1"/)
  assert.match(b, /data-pw-chrome-btn="favorite-product"/)
  assert.doesNotMatch(bMobile, /data-pw-chrome-btn="favorite-product"/)
})
