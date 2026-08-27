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
    /id="absolute"[^>]*data-pw-placement="scene-absolute"[^>]*data-pw-box-x="75"[^>]*data-pw-box-y="148"/
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
  assert.match(first, /data-pw-box-x="75"/)
  assert.doesNotMatch(first, /data-pw-box-x="78"/)
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
