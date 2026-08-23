import assert from 'node:assert/strict'
import test from 'node:test'
import {
  copyPageCloneElementsAcrossSameDevicePages,
  extractPageClones,
  parseCloneBox,
  shouldReceivePageClone,
} from '@/lib/partner-website/visual-editor/copy-element-across-pages'

const SOURCE_BG = `<div data-pw-added-bg="1" data-pw-clone-id="c1" data-pw-clone-all="1" data-pw-clone-box="abs,80,40,400,120" style="position:absolute;left:80px;top:40px;width:400px;height:120px;background:#f97316"></div>`

function page(mainInner: string): string {
  return `<!doctype html><html><body><header class="pw-header" data-pw-region="header">H</header><main>${mainInner}</main><footer class="pw-footer" data-pw-region="footer">F</footer></body></html>`
}

test('copies an overlay onto other pages of the same device at the same coordinates', () => {
  const project = {
    files: [
      { path: 'index.html', kind: 'html', content: page(SOURCE_BG) },
      { path: 'cart.html', kind: 'html', content: page('<p>cart</p>') },
      { path: 'about.html', kind: 'html', content: page('<p>about</p>') },
      { path: 'cart.mobile.html', kind: 'html', content: page('<p>mobile cart</p>') },
      { path: 'index.mobile.html', kind: 'html', content: page('<p>mobile home</p>') },
    ],
  }
  const next = copyPageCloneElementsAcrossSameDevicePages(project, 'index.html', page(SOURCE_BG))
  assert.equal(next.cloneCount, 1)
  assert.equal(next.copiedPageCount, 2)
  const cart = next.project.files.find((f) => f.path === 'cart.html')?.content || ''
  const about = next.project.files.find((f) => f.path === 'about.html')?.content || ''
  const mobile = next.project.files.find((f) => f.path === 'cart.mobile.html')?.content || ''
  assert.match(cart, /data-pw-clone-id="c1"/)
  assert.match(cart, /left:80px/)
  assert.match(cart, /top:40px/)
  assert.doesNotMatch(cart, /data-pw-clone-all="1"/)
  assert.match(about, /data-pw-clone-id="c1"/)
  assert.doesNotMatch(mobile, /data-pw-clone-id="c1"/)
})

test('replaces an existing clone on the same device instead of stacking a second copy', () => {
  const old = `<div data-pw-clone-id="c1" style="position:absolute;left:10px;top:10px;width:40px;height:40px"></div>`
  const project = {
    files: [
      { path: 'index.html', kind: 'html', content: page(SOURCE_BG) },
      { path: 'cart.html', kind: 'html', content: page(old) },
    ],
  }
  const next = copyPageCloneElementsAcrossSameDevicePages(project, 'index.html', page(SOURCE_BG))
  const cart = next.project.files.find((f) => f.path === 'cart.html')?.content || ''
  assert.equal(cart.match(/data-pw-clone-id="c1"/g)?.length, 1)
  assert.match(cart, /left:80px/)
  assert.doesNotMatch(cart, /left:10px/)
})

test('skips 404 and per-product HTML', () => {
  assert.equal(shouldReceivePageClone('404.html', 'index.html'), false)
  assert.equal(
    shouldReceivePageClone('p/11111111-1111-1111-1111-111111111111.html', 'index.html'),
    false
  )
  assert.equal(shouldReceivePageClone('product-detail.html', 'index.html'), true)
  assert.equal(shouldReceivePageClone('cart.mobile.html', 'index.mobile.html'), true)
  assert.equal(shouldReceivePageClone('cart.html', 'index.mobile.html'), false)
})

test('seeds missing catalog pages such as orders.html on the same device', () => {
  const project = {
    files: [{ path: 'index.html', kind: 'html', content: page(SOURCE_BG) }],
  }
  const next = copyPageCloneElementsAcrossSameDevicePages(project, 'index.html', page(SOURCE_BG), {
    seedMissingHtml: () => page('<p>seed</p>'),
  })
  const orders = next.project.files.find((f) => f.path === 'orders.html')?.content || ''
  assert.match(orders, /data-pw-clone-id="c1"/)
  assert.match(orders, /left:80px/)
  assert.match(orders, /top:40px/)
  assert.ok(next.pageKeys.includes('orders'))
  assert.doesNotMatch(
    next.project.files.find((f) => f.path === 'orders.mobile.html')?.content || '',
    /data-pw-clone-id="c1"/
  )
})

test('parses clone box and extracts only clone-all sources', () => {
  assert.deepEqual(parseCloneBox('abs,12,8,100,40'), {
    mode: 'abs',
    left: 12,
    top: 8,
    width: 100,
    height: 40,
  })
  assert.deepEqual(parseCloneBox('flow'), { mode: 'flow', left: 0, top: 0, width: 0, height: 0 })
  const clones = extractPageClones(page(`${SOURCE_BG}<div data-pw-clone-id="other">x</div>`))
  assert.equal(clones.length, 1)
  assert.equal(clones[0]?.id, 'c1')
})
