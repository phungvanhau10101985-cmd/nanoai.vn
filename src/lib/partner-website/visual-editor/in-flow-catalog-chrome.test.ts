import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHTML } from 'linkedom'
import {
  isInFlowCatalogChromeAttrs,
  isInFlowCatalogChromeElement,
  isInFlowCatalogChromeRole,
  isInFlowStackBlockAttrs,
  isInFlowStackHostElement,
  reflowInFlowStackHosts,
  releaseInFlowStackBlock,
} from './in-flow-catalog-chrome'

test('catalog title and see-more are in-flow chrome', () => {
  assert.equal(isInFlowCatalogChromeRole('section-title'), true)
  assert.equal(isInFlowCatalogChromeRole('section-more'), true)
  assert.equal(isInFlowCatalogChromeRole('card-price'), false)
  assert.equal(
    isInFlowCatalogChromeAttrs(' data-pw-el="section-title" data-pw-placement="scene-absolute"'),
    true
  )
  assert.equal(
    isInFlowCatalogChromeAttrs(' data-pw-chrome-added="1" data-pw-chrome-btn="stores" data-pw-box-x="12"'),
    false
  )
})

test('elements inside a catalog stay in-flow unless they are authored overlays', () => {
  const { document } = parseHTML(`<!doctype html><html><body>
    <section data-pw-region="catalog" data-pw-catalog>
      <div class="pw-section-head"><h2 data-pw-el="section-title">Title</h2></div>
      <a data-pw-chrome-added="1" data-pw-chrome-btn="stores">Cửa hàng</a>
      <p data-pw-added-text="1">Overlay</p>
    </section>
  </body></html>`)
  const title = document.querySelector('[data-pw-el="section-title"]')
  const store = document.querySelector('[data-pw-chrome-btn="stores"]')
  const overlay = document.querySelector('[data-pw-added-text="1"]')
  const head = document.querySelector('.pw-section-head')
  assert.equal(isInFlowCatalogChromeElement(title), true)
  assert.equal(isInFlowCatalogChromeElement(head), true)
  assert.equal(isInFlowCatalogChromeElement(store), false)
  assert.equal(isInFlowCatalogChromeElement(overlay), false)
})

test('banner, categories, and in-flow added-bg stay stack hosts', () => {
  assert.equal(
    isInFlowStackBlockAttrs(' class="pw-hero" data-pw-region="banner" data-pw-placement="scene-absolute"'),
    true
  )
  assert.equal(isInFlowStackBlockAttrs(' data-pw-region="categories"'), true)
  assert.equal(isInFlowStackBlockAttrs(' data-pw-added-banner="1"'), true)
  assert.equal(isInFlowStackBlockAttrs(' data-pw-added-bg-slot="1" data-pw-added-bg="1"'), true)
  assert.equal(isInFlowCatalogChromeAttrs(' class="pw-hero-copy" data-pw-el="copy"'), false)
  assert.equal(
    isInFlowStackBlockAttrs(' data-pw-added-bg="1" data-pw-placement="scene-absolute"'),
    false
  )
  const { document } = parseHTML(`<!doctype html><html><body>
    <main>
      <section class="pw-hero" data-pw-region="banner"><h1 data-pw-el="title">Hero</h1></section>
      <section class="pw-categories" data-pw-region="categories"></section>
      <div data-pw-added-bg="1" data-pw-added-bg-slot="1"></div>
      <div data-pw-added-bg="1"></div>
    </main>
  </body></html>`)
  const banner = document.querySelector('[data-pw-region="banner"]')
  const title = document.querySelector('[data-pw-el="title"]')
  const cats = document.querySelector('[data-pw-region="categories"]')
  const slot = document.querySelector('[data-pw-added-bg-slot]')
  const overlay = document.querySelector('[data-pw-added-bg="1"]:not([data-pw-added-bg-slot])')
  assert.equal(isInFlowStackHostElement(banner), true)
  assert.equal(isInFlowCatalogChromeElement(banner), true)
  assert.equal(isInFlowStackHostElement(title), false)
  assert.equal(isInFlowStackHostElement(cats), true)
  assert.equal(isInFlowStackHostElement(slot), true)
  assert.equal(isInFlowStackHostElement(overlay), false)
})

test('reflow releases leftover absolute but keeps authored DOM order', () => {
  const { document } = parseHTML(`<!doctype html><html><body>
    <main>
      <section id="banner" data-pw-region="banner"></section>
      <section id="cats" data-pw-region="categories"></section>
      <section id="fav" data-pw-region="catalog" data-pw-personalize="favorites" data-pw-placement="scene-absolute" style="position:absolute;top:90px"></section>
    </main>
  </body></html>`)
  const main = document.querySelector('main')
  const banner = document.querySelector('#banner') as HTMLElement
  const fav = document.querySelector('#fav') as HTMLElement
  banner.getBoundingClientRect = () =>
    ({ top: 80, left: 0, width: 1200, height: 332, right: 1200, bottom: 412 }) as DOMRect
  fav.getBoundingClientRect = () =>
    ({ top: 90, left: 0, width: 1200, height: 120, right: 1200, bottom: 210 }) as DOMRect
  reflowInFlowStackHosts(main)
  assert.equal(main?.children[0]?.id, 'banner')
  assert.equal(main?.children[1]?.id, 'cats')
  assert.equal(main?.children[2]?.id, 'fav')
  assert.equal(fav.getAttribute('data-pw-placement'), null)
  assert.doesNotMatch(fav.getAttribute('style') || '', /position:\s*absolute/)
  banner.setAttribute('data-pw-z', '200')
  banner.setAttribute('style', 'z-index:200!important')
  releaseInFlowStackBlock(banner)
  assert.equal(banner.getAttribute('data-pw-z'), null)
  assert.doesNotMatch(banner.getAttribute('style') || '', /z-index/)
  releaseInFlowStackBlock(banner)
  assert.equal(banner.getAttribute('data-pw-box-y'), null)
})
