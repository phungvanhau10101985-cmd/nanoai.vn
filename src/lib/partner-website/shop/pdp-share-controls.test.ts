import assert from 'node:assert/strict'
import test from 'node:test'
import { bindPdpShareControlsToHtml } from '@/lib/partner-website/shop/pdp-share-controls'

const HTML = `<div data-pw-region="gallery"><img data-pw-el="main-image" src="https://cdn.example/a.jpg" alt=""/></div>
<div data-pw-region="pdp-info"><h1 data-pw-el="title">Áo</h1><p class="pw-pdp-sku">SKU</p></div>`

test('PDP share adds a gallery icon and copy/share actions', () => {
  const out = bindPdpShareControlsToHtml(HTML, 'vi')
  assert.match(out, /pw-pdp-share-icon/)
  assert.match(out, /data-pw-share="copy"/)
  assert.match(out, /data-pw-share="native"/)
  assert.match(out, /Chia sẻ/)
  assert.equal(bindPdpShareControlsToHtml(out, 'vi'), out)
})
