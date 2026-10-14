import assert from 'node:assert/strict'
import test from 'node:test'

import { isBlockedIp, isBlockedPasteHost, mightBeRemoteImage, singleHttpUrl, singleImageDataUrl, sniffImageMime } from '@/lib/chat/paste-image'

test('a single image link is kept and a sentence is left alone', () => {
  assert.equal(singleHttpUrl('https://cdn.example.com/a.png'), 'https://cdn.example.com/a.png')
  assert.equal(singleHttpUrl('  https://cdn.example.com/photo '), 'https://cdn.example.com/photo')
  assert.equal(singleHttpUrl('xem https://cdn.example.com/a.png'), null)
  assert.equal(singleHttpUrl('https://user:pass@cdn.example.com/a.png'), null)
  assert.equal(singleImageDataUrl('data:image/png;base64,aaaa'), 'data:image/png;base64,aaaa')
  assert.equal(singleImageDataUrl('data:image/svg+xml;base64,aaaa'), null)
  assert.equal(mightBeRemoteImage('https://cdn.example.com/a.png'), true)
  assert.equal(mightBeRemoteImage('https://cdn.example.com/photo'), true)
  assert.equal(mightBeRemoteImage('https://shop.example.com/san-pham.html'), false)
  assert.equal(mightBeRemoteImage('xem https://cdn.example.com/a.png'), false)
})

test('private hosts and link-local addresses are blocked', () => {
  assert.equal(isBlockedPasteHost('localhost'), true)
  assert.equal(isBlockedPasteHost('metadata.google.internal'), true)
  assert.equal(isBlockedPasteHost('cdn.example.com'), false)
  assert.equal(isBlockedIp('127.0.0.1'), true)
  assert.equal(isBlockedIp('10.1.2.3'), true)
  assert.equal(isBlockedIp('192.168.1.8'), true)
  assert.equal(isBlockedIp('8.8.8.8'), false)
  assert.equal(isBlockedIp('::1'), true)
})

test('file signatures identify jpeg png gif and webp', () => {
  assert.equal(sniffImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg')
  assert.equal(sniffImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])), 'image/png')
  assert.equal(sniffImageMime(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), 'image/gif')
  assert.equal(
    sniffImageMime(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    'image/webp'
  )
  assert.equal(sniffImageMime(Uint8Array.from([0x3c, 0x68, 0x74, 0x6d, 0x6c])), null)
})
