import assert from 'node:assert/strict'
import test from 'node:test'
import { guestChatSameOriginImageSrc, messagingStoragePathFromUrl } from './guest-chat-image-src'

const PARTNER = '11111111-1111-4111-8111-111111111111'
const PATH = `messaging-guest/${PARTNER}/photo.jpg`

test('bunny pull-zone URL of a chat photo maps to same-origin', () => {
  const src = guestChatSameOriginImageSrc(`https://shop.b-cdn.net/${PATH}`)
  assert.equal(src, `/api/messaging/chat-image?path=${encodeURIComponent(PATH)}`)
  assert.equal(messagingStoragePathFromUrl(`https://cdn.188.com.vn/${PATH}?v=1`), PATH)
})

test('product CDN urls stay on the public host', () => {
  assert.equal(guestChatSameOriginImageSrc('https://cdn.188.com.vn/site/manual-products/a.jpg'), null)
  assert.equal(messagingStoragePathFromUrl('https://shop.b-cdn.net/messaging-guest/../etc/passwd'), null)
})
