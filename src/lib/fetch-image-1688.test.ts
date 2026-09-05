import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchImageWith1688Bypass } from '@/lib/fetch-image-1688'

test('storefront image fetch rejects declared payloads above its byte budget', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
      status: 200,
      headers: { 'content-type': 'image/jpeg', 'content-length': '1000' },
    })) as typeof fetch
  try {
    await assert.rejects(
      fetchImageWith1688Bypass('https://example.com/large.jpg', { maxBytes: 100 }),
      /vượt giới hạn/
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('storefront image fetch rejects streamed payloads above its byte budget', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(new Uint8Array(256).fill(1), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    })) as typeof fetch
  try {
    await assert.rejects(
      fetchImageWith1688Bypass('https://example.com/large.jpg', { maxBytes: 100 }),
      /vượt giới hạn/
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
