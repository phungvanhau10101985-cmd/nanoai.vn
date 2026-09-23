import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildViewedProductSnapshotBootScript,
  discardViewedProductSnapshots,
  type ViewedProductStorage,
} from '@/lib/partner-website/shop/partner-site-viewed-product-cache'

function memoryStorage(seed: Record<string, string> = {}): ViewedProductStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed))
  return {
    data,
    get length() {
      return data.size
    },
    key: (index) => Array.from(data.keys())[index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

test('discardViewedProductSnapshots removes saved product html and leaves other keys', () => {
  const storage = memoryStorage({
    'pw-viewed-pdp-index-v1': '["pw-viewed-pdp-v1:gudo.vn/products/ao"]',
    'pw-viewed-pdp-v1:gudo.vn/products/ao': '{"doc":"<html></html>"}',
    'pw-viewed-pdp-v2:gudo.vn/products/ao': '{"doc":"<html></html>"}',
    'pw-account-cache-v1:gudo': '{"name":"A"}',
  })
  discardViewedProductSnapshots(storage)
  assert.equal(storage.data.has('pw-viewed-pdp-v1:gudo.vn/products/ao'), false)
  assert.equal(storage.data.has('pw-viewed-pdp-v2:gudo.vn/products/ao'), false)
  assert.equal(storage.data.has('pw-viewed-pdp-index-v1'), false)
  assert.equal(storage.data.get('pw-account-cache-v1:gudo'), '{"name":"A"}')
})

test('snapshot boot script only deletes saved pages and does not paint one', () => {
  const script = buildViewedProductSnapshotBootScript()
  assert.doesNotThrow(() => new Function(script))
  assert.match(script, /localStorage\.removeItem/)
  assert.match(script, /pw-viewed-pdp-/)
  assert.doesNotMatch(script, /srcdoc/)
  assert.doesNotMatch(script, /createElement\('iframe'\)/)
})
