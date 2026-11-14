import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { acceptedImageMime, eraseMatchedColor, hexToRgb, isEditableTranslateImageUrl } from './edit-image-source'

describe('editable translate image url', () => {
  it('allows the shop CDN and the configured public base only', () => {
    assert.equal(isEditableTranslateImageUrl('https://nanoai.b-cdn.net/results/a.png'), true)
    assert.equal(isEditableTranslateImageUrl('https://cdn.example.com/a.png', 'https://cdn.example.com'), true)
    assert.equal(isEditableTranslateImageUrl('http://localhost:3000/dich-anh-tai-lieu/a.webp'), false)
    assert.equal(isEditableTranslateImageUrl('http://localhost:3000/dich-anh-tai-lieu/a.webp', null, { allowLocal: true }), true)
    assert.equal(isEditableTranslateImageUrl('http://127.0.0.1:5432/a.png', null, { allowLocal: true }), false)
    assert.equal(isEditableTranslateImageUrl('http://nanoai.b-cdn.net/a.png'), false)
    assert.equal(isEditableTranslateImageUrl('https://user:pass@nanoai.b-cdn.net/a.png'), false)
    assert.equal(isEditableTranslateImageUrl('https://evil.example/storage/v1/object/public/try-on-images/a.png'), false)
    assert.equal(isEditableTranslateImageUrl('https://8.8.8.8/a.png'), false)
  })
})

describe('erase matched color', () => {
  it('clears only pixels inside the tolerance', () => {
    const data = new Uint8ClampedArray([
      10, 10, 10, 255,
      20, 12, 11, 255,
      200, 200, 200, 255,
      10, 10, 10, 0,
    ])
    const changed = eraseMatchedColor(data, { r: 10, g: 10, b: 10 }, 12)
    assert.equal(changed, 2)
    assert.equal(data[3], 0)
    assert.equal(data[7], 0)
    assert.equal(data[11], 255)
    assert.equal(data[15], 0)
  })
})

describe('image mime', () => {
  it('reads a png signature when the server omits the type', () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    assert.equal(acceptedImageMime('application/octet-stream', png), 'image/png')
    assert.equal(acceptedImageMime('image/png; charset=binary', png), 'image/png')
    assert.equal(hexToRgb('#0a0b0c')?.b, 12)
    assert.equal(acceptedImageMime('text/html', png), null)
  })
})
