import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeVisualCoordinateContract,
  visualCoordinateContractVersionOf,
} from './normalize-visual-coordinate-contract'
import { PW_COORDINATE_CONTRACT_VERSION } from './pw-coordinate-space'

const legacyHtml = `<!doctype html>
<html data-pw-edit-device="desktop">
  <body>
    <main>
      <div id="absolute" data-pw-added-text="1" data-pw-canvas-x="72" data-pw-canvas-y="144"
        data-pw-canvas-w="240" data-pw-canvas-h="60"
        style="position:absolute;left:72px;top:144px;transform:translate(3px, 4px);color:red">Text</div>
      <div id="fixed" data-pw-added-btn="1" data-pw-stay-scroll="1"
        data-pw-stay-x="25" data-pw-stay-y="50" data-pw-stay-w="80" data-pw-stay-h="40"
        data-pw-box-x="999" data-pw-box-y="998" data-pw-box-w="997" data-pw-box-h="996"
        style="position:fixed;left:25%;top:50%;width:80px;height:40px">Fixed</div>
      <section id="flow" data-pw-added-bg-slot="1" data-pw-canvas-x="9"
        data-pw-box-x="8" data-pw-box-y="7" data-pw-box-w="6" data-pw-box-h="5"
        style="position:absolute;left:9px;top:7px;background:blue">Flow</section>
    </main>
  </body>
</html>`

test('dual-reads legacy geometry and writes only the canonical coordinate contract', () => {
  const canonical = normalizeVisualCoordinateContract(legacyHtml, {
    variant: 'desktop',
    writeCanonicalOnly: true,
  })

  assert.equal(visualCoordinateContractVersionOf(canonical), PW_COORDINATE_CONTRACT_VERSION)
  assert.match(canonical, /<main[^>]*data-pw-scene-root="1"/)
  assert.match(
    canonical,
    /id="absolute"[^>]*data-pw-placement="scene-absolute"[^>]*data-pw-box-x="-525"[^>]*data-pw-box-y="178"/
  )
  assert.match(
    canonical,
    /id="fixed"[^>]*data-pw-placement="viewport-fixed"[^>]*data-pw-fixed-x="0\.25"[^>]*data-pw-fixed-y="0\.5"/
  )
  assert.match(canonical, /id="flow"[^>]*data-pw-placement="flow"/)
  assert.doesNotMatch(canonical, /data-pw-(?:canvas|stay)-(?:x|y|w|h|xu|yu)=/)
  assert.doesNotMatch(canonical.match(/<div id="fixed"[^>]*>/)?.[0] || '', /data-pw-box-/)
  assert.doesNotMatch(canonical.match(/<section id="flow"[^>]*>/)?.[0] || '', /data-pw-box-/)
  assert.doesNotMatch(canonical, /transform:translate/)
})

test('canonical normalization is byte-idempotent', () => {
  const once = normalizeVisualCoordinateContract(legacyHtml, {
    variant: 'desktop',
    writeCanonicalOnly: true,
  })
  const twice = normalizeVisualCoordinateContract(once, {
    variant: 'desktop',
    writeCanonicalOnly: true,
  })
  assert.equal(twice, once)
})

test('render-time dual-read does not accumulate legacy translate after canonicalization', () => {
  const first = normalizeVisualCoordinateContract(legacyHtml, { variant: 'desktop' })
  const second = normalizeVisualCoordinateContract(first, { variant: 'desktop' })
  assert.equal(second, first)
  assert.match(first, /data-pw-box-x="-525"/)
  assert.doesNotMatch(first, /data-pw-box-x="-522"/)
})

test('catalog title and see-more stay in-flow instead of scene-absolute', () => {
  const html = `<html data-pw-edit-device="desktop"><body><main>
    <section data-pw-region="catalog">
      <h2 data-pw-el="section-title" data-pw-user-move="1" data-pw-placement="scene-absolute"
        data-pw-box-x="12" data-pw-box-y="240" style="position:absolute;left:10px;top:20px">CÓ THỂ BẠN THÍCH</h2>
      <a data-pw-el="section-more" data-pw-placement="scene-absolute" data-pw-box-x="400"
        style="position:absolute;left:900px;top:20px">XEM SẢN PHẨM</a>
      <a data-pw-chrome-added="1" data-pw-chrome-btn="stores" data-pw-placement="scene-absolute"
        data-pw-box-x="-600" data-pw-box-y="180">Cửa hàng</a>
    </section>
  </main></body></html>`
  const next = normalizeVisualCoordinateContract(html, { variant: 'desktop' })
  const title = next.match(/<h2\b[^>]*>/)?.[0] || ''
  const more = next.match(/<a\b[^>]*data-pw-el="section-more"[^>]*>/)?.[0] || ''
  const store = next.match(/<a\b[^>]*data-pw-chrome-btn="stores"[^>]*>/)?.[0] || ''
  assert.match(title, /data-pw-placement="flow"/)
  assert.doesNotMatch(title, /data-pw-box-x/)
  assert.doesNotMatch(title, /data-pw-user-move/)
  assert.doesNotMatch(title, /position:absolute/)
  assert.match(more, /data-pw-placement="flow"/)
  assert.doesNotMatch(more, /data-pw-box-x/)
  assert.match(store, /data-pw-placement="scene-absolute"/)
  assert.match(store, /data-pw-box-x="/)
})

test('banner and category hosts stay in-flow instead of scene-absolute', () => {
  const html = `<html data-pw-edit-device="desktop"><body><main>
    <section class="pw-hero" data-pw-region="banner" data-pw-user-move="1" data-pw-placement="scene-absolute"
      data-pw-box-x="0" data-pw-box-y="180" style="position:absolute;left:120px;top:80px">Banner</section>
    <section data-pw-region="categories" data-pw-placement="scene-absolute" style="position:absolute;top:200px">Cats</section>
    <div data-pw-added-bg="1" data-pw-placement="scene-absolute" data-pw-box-x="12" style="position:absolute;left:10px">Bg</div>
  </main></body></html>`
  const next = normalizeVisualCoordinateContract(html, { variant: 'desktop' })
  const banner = next.match(/<section\b[^>]*data-pw-region="banner"[^>]*>/)?.[0] || ''
  const cats = next.match(/<section\b[^>]*data-pw-region="categories"[^>]*>/)?.[0] || ''
  const bg = next.match(/<div\b[^>]*data-pw-added-bg="1"[^>]*>/)?.[0] || ''
  assert.match(banner, /data-pw-placement="flow"/)
  assert.doesNotMatch(banner, /data-pw-box-x/)
  assert.doesNotMatch(banner, /position:absolute/)
  assert.match(cats, /data-pw-placement="flow"/)
  assert.match(bg, /data-pw-placement="scene-absolute"/)
})

test('page links keep authored text and fill colors as CSS vars', () => {
  const html = `<html data-pw-edit-device="mobile"><body>
    <footer class="pw-footer" data-pw-region="footer">
      <a href="/site/demo/payment" data-pw-el="link" data-pw-btn-color="#111827" data-pw-btn-text="#ffffff">Thanh toán</a>
    </footer>
  </body></html>`
  const next = normalizeVisualCoordinateContract(html, {
    variant: 'mobile',
    writeCanonicalOnly: true,
  })
  const link = next.match(/<a\b[^>]*data-pw-el="link"[^>]*>/)?.[0] || ''
  assert.match(link, /data-pw-btn-color="#111827"/)
  assert.match(link, /data-pw-btn-text="#ffffff"/)
  assert.match(link, /--pw-btn-color:#111827/)
  assert.match(link, /--pw-btn-text:#ffffff/)
})

test('kit float buttons keep authored colors and drop runtime seat geometry', () => {
  const html = `<html data-pw-edit-device="desktop"><body><main></main>
    <aside data-pw-chrome-kit="float">
      <button id="chat" data-pw-chrome-btn="chat" data-pw-chrome-float="1" data-pw-chrome-kit="1"
        data-pw-btn-color="#111111" data-pw-placement="viewport-fixed" data-pw-fixed-x="0.4"
        style="position:fixed;right:16px;--pw-btn-color:#111111">Chat</button>
    </aside>
  </body></html>`
  const next = normalizeVisualCoordinateContract(html, {
    variant: 'desktop',
    writeCanonicalOnly: true,
  })
  const chat = next.match(/<button\b[^>]*id="chat"[^>]*>/)?.[0] || ''
  assert.match(chat, /data-pw-btn-color="#111111"/)
  assert.match(chat, /--pw-btn-color:#111111/)
  assert.doesNotMatch(chat, /data-pw-placement/)
  assert.doesNotMatch(chat, /data-pw-fixed-x/)
  assert.doesNotMatch(chat, /position:fixed/)
})

test('normalizer leaves raw script, style, textarea, and template contents untouched', () => {
  const raw =
    '<html><body><main><script>const card = `<div data-pw-added-text="1" style="position:absolute;left:1px;top:2px">`</script><style>.x::before{content:"<main>"}</style><template><div data-pw-canvas-x="1"></div></template></main></body></html>'
  const normalized = normalizeVisualCoordinateContract(raw, {
    variant: 'desktop',
    writeCanonicalOnly: true,
  })
  assert.match(normalized, /const card = `<div data-pw-added-text="1" style="position:absolute;left:1px;top:2px">`/)
  assert.match(normalized, /<template><div data-pw-canvas-x="1"><\/div><\/template>/)
})
