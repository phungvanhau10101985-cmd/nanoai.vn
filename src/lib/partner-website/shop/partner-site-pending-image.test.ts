import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dataUrlToFile,
  isPartnerImageSearchPath,
  PW_PENDING_IMAGE_EVENT,
  PW_PENDING_IMAGE_KEY,
} from '@/lib/partner-website/shop/partner-site-pending-image'

test('pending image key and event are stable for header → /tim-theo-anh', () => {
  assert.equal(PW_PENDING_IMAGE_KEY, 'pw_pending_image_v1')
  assert.equal(PW_PENDING_IMAGE_EVENT, 'pw-pending-image-ready')
})

test('isPartnerImageSearchPath matches platform and custom-domain routes', () => {
  assert.equal(isPartnerImageSearchPath('/site/188-shop/tim-theo-anh', '/site/188-shop/tim-theo-anh'), true)
  assert.equal(isPartnerImageSearchPath('/tim-theo-anh', '/site/188-shop/tim-theo-anh'), true)
  assert.equal(isPartnerImageSearchPath('/site/188-shop/search', '/site/188-shop/tim-theo-anh'), false)
})

test('dataUrlToFile round-trips a tiny jpeg data URL', () => {
  const jpeg =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAD//2Q=='
  const file = dataUrlToFile(jpeg)
  assert.equal(file.type, 'image/jpeg')
  assert.ok(file.size > 0)
})
