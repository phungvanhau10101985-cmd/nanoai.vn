import assert from 'node:assert/strict'
import test from 'node:test'
import { rewriteLegacyBunnyCdnUrl } from './bunny-cdn-url'

test('legacy platform host rewrites to the public CDN', () => {
  const prev = process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL
  const prevStorage = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL
  process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL = 'https://cdn.nanoai.vn'
  delete process.env.BUNNY_STORAGE_PUBLIC_BASE_URL
  try {
    assert.equal(
      rewriteLegacyBunnyCdnUrl('https://nanoai.b-cdn.net/messaging-partner/p/a.jpg'),
      'https://cdn.nanoai.vn/messaging-partner/p/a.jpg'
    )
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL
    else process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL = prev
    if (prevStorage === undefined) delete process.env.BUNNY_STORAGE_PUBLIC_BASE_URL
    else process.env.BUNNY_STORAGE_PUBLIC_BASE_URL = prevStorage
  }
})

test('shop pull zone host is not rewritten onto the platform CDN', () => {
  const prev = process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL
  process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL = 'https://cdn.nanoai.vn'
  try {
    const shop = 'https://gudo-ab12.b-cdn.net/localized-images/p/a.jpg'
    assert.equal(rewriteLegacyBunnyCdnUrl(shop), shop)
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL
    else process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL = prev
  }
})
