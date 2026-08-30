import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHTML } from 'linkedom'
import {
  ensureContentSceneRoot,
  isOuterSceneChromeNode,
  isSceneAbsoluteOverlay,
  PW_SCENE_ORIGIN_ATTR,
  PW_SCENE_ORIGIN_CONTENT,
  PW_SCENE_ROOT_ATTR,
} from './ensure-content-scene-root'
import { buildDefaultLandingV1Site } from '../template/default-landing-v1'
import { renderTemplateSiteToHtml } from '../template/render-template-html'

function parseDoc(html: string): Document {
  return parseHTML(html).document as unknown as Document
}

function stubRect(
  el: Element,
  rect: { left: number; top: number; width: number; height: number }
): void {
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON() {
        return rect
      },
    }) as DOMRect
}

test('home factory wraps sections in main scene-root, not body', () => {
  const site = buildDefaultLandingV1Site({
    locale: 'vi',
    title: 'Shop',
    briefText: 'Shop',
    theme: {},
  })
  const html = renderTemplateSiteToHtml({
    locale: 'vi',
    title: 'Shop',
    templateId: 'fashion-v1',
    theme: site.theme,
    pages: site.pages,
    logoUrl: null,
    samplePreview: true,
  })
  assert.match(html, /<main id="pw-main"[^>]*data-pw-scene-root="1"/)
  assert.match(html, /data-pw-scene-origin="content"/)
  assert.match(html, /<header[\s\S]*<\/header>\s*<main /)
})

test('ensureContentSceneRoot wraps home-without-main and remeasures overlay Y from main', () => {
  const doc = parseDoc(`<!doctype html><html><body>
    <header class="pw-header" data-pw-region="header">Head</header>
    <section data-pw-region="banner">Banner</section>
    <a data-pw-placement="scene-absolute" data-pw-box-x="-520" data-pw-box-y="580"
      data-pw-box-w="120" data-pw-box-h="24" style="position:absolute;top:568px">Vận chuyển</a>
    <footer class="pw-footer" data-pw-region="footer">Foot</footer>
  </body></html>`)
  const body = doc.body
  const header = body.querySelector('header')!
  const banner = body.querySelector('section')!
  const overlay = body.querySelector('a')!
  stubRect(header, { left: 0, top: 0, width: 1440, height: 180 })
  stubRect(banner, { left: 0, top: 180, width: 1440, height: 400 })
  stubRect(overlay, { left: 40, top: 568, width: 120, height: 24 })

  const main = ensureContentSceneRoot(body)!
  stubRect(main, { left: 0, top: 180, width: 1440, height: 400 })
  const again = ensureContentSceneRoot(body)!
  assert.equal(again, main)
  assert.equal(main.getAttribute(PW_SCENE_ROOT_ATTR), '1')
  assert.equal(main.getAttribute(PW_SCENE_ORIGIN_ATTR), PW_SCENE_ORIGIN_CONTENT)
  assert.equal(banner.parentElement, main)
  assert.equal(header.parentElement, body)
  assert.equal(body.querySelector('footer')?.parentElement, body)
  assert.equal(overlay.parentElement, main)
  assert.equal(overlay.getAttribute('data-pw-box-y'), '400')
  assert.equal(isOuterSceneChromeNode(header), true)
  assert.equal(isSceneAbsoluteOverlay(overlay), true)
})

test('existing main is reused and not treated as a body origin', () => {
  const doc = parseDoc(`<!doctype html><html><body>
    <header class="pw-header">Head</header>
    <main data-pw-scene-root="1" data-pw-scene-origin="content">
      <section data-pw-region="banner">Banner</section>
    </main>
  </body></html>`)
  const main = doc.querySelector('main')!
  const next = ensureContentSceneRoot(doc.body)
  assert.equal(next, main)
  assert.equal(doc.querySelectorAll('main').length, 1)
})
