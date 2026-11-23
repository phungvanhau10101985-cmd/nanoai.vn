import assert from 'node:assert/strict'
import test from 'node:test'
import { isPlatformImageCdnUrl } from '@/lib/bunny-cdn-url'
import { resolveImageDownloadFetchUrl } from '@/lib/download-image-client'
import { bunnyStoragePutTimeoutMs, uploadBunnyStorageObject, type BunnyStorageAuth } from '@/lib/storage/try-on-public-upload'

const auth: BunnyStorageAuth = {
  zone: 'unit-zone',
  accessKey: 'unit-key',
  publicBase: 'https://cdn.nanoai.vn',
  storageHost: 'storage.bunnycdn.com',
}

test('result image upload waits longer than the 60s abort that failed GPT saves', () => {
  assert.equal(bunnyStoragePutTimeoutMs(32), 60_000)
  assert.equal(bunnyStoragePutTimeoutMs(3 * 1024 * 1024), 140_000)
  assert.equal(bunnyStoragePutTimeoutMs(40 * 1024 * 1024), 180_000)
})

test('CDN PUT timeout becomes a message the image tool can show', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
  }) as typeof fetch
  try {
    await assert.rejects(
      uploadBunnyStorageObject('results/user/edit.png', Buffer.alloc(1024 * 1024), { contentType: 'image/png' }, auth),
      /Lưu ảnh lên CDN quá thời gian/
    )
  } finally {
    globalThis.fetch = original
  }
})

test('downloading a platform result asks the proxy to allow the original file', () => {
  const url = resolveImageDownloadFetchUrl('https://cdn.nanoai.vn/results/user/edit_1.png')
  assert.match(url, /^\/api\/fetch-image\?/)
  assert.match(url, /dl=1/)
  assert.equal(isPlatformImageCdnUrl('https://cdn.nanoai.vn/results/user/edit_1.png'), true)
  assert.equal(isPlatformImageCdnUrl('https://shop.b-cdn.net/a.png'), true)
  assert.equal(isPlatformImageCdnUrl('https://example.com/a.png'), false)
})
