import assert from 'node:assert/strict'
import test from 'node:test'
import { bunnyStorageObjectExists, type BunnyStorageAuth } from './try-on-public-upload'

const auth: BunnyStorageAuth = {
  zone: 'unit-zone',
  accessKey: 'unit-key',
  publicBase: 'https://cdn.example',
  storageHost: 'storage.bunnycdn.com',
}

test('guest chat image exists when ranged GET is 206, without calling HEAD', async () => {
  const methods: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (_input: unknown, init?: { method?: string }) => {
    const method = init?.method || 'GET'
    methods.push(method)
    return new Response(new Uint8Array([0xff, 0xd8]), { status: method === 'GET' ? 206 : 401 })
  }) as typeof fetch
  try {
    const ok = await bunnyStorageObjectExists('messaging-guest/partner/photo.jpg', auth)
    assert.equal(ok, true)
    assert.deepEqual(methods, ['GET'])
  } finally {
    globalThis.fetch = original
  }
})

test('HEAD 401 is not treated as a missing chat image', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async (_input: unknown, init?: { method?: string }) => {
    const method = init?.method || 'GET'
    if (method === 'HEAD') return new Response(null, { status: 401 })
    return new Response(new Uint8Array([1]), { status: 206 })
  }) as typeof fetch
  try {
    const ok = await bunnyStorageObjectExists('messaging-guest/partner/photo.jpg', auth)
    assert.equal(ok, true)
  } finally {
    globalThis.fetch = original
  }
})
