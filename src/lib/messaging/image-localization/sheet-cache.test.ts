import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  imageLocSheetKinds,
  normalizeImageLocSheetKey,
  resolveStoredImageLocSheet,
} from './sheet-cache'

describe('saved size and laundry sheets', () => {
  it('normalizes the Chinese shop and category key', () => {
    assert.equal(normalizeImageLocSheetKey('  旗舰店   '), '旗舰店')
    assert.equal(normalizeImageLocSheetKey(''), '')
  })

  it('reuses a stored sheet only when every kind on the image is already saved', () => {
    assert.equal(resolveStoredImageLocSheet(['size'], { size: 'https://cdn.example/size.jpg' }), 'https://cdn.example/size.jpg')
    assert.equal(resolveStoredImageLocSheet(['laundry'], { size: 'https://cdn.example/size.jpg' }), null)
    assert.equal(
      resolveStoredImageLocSheet(['size', 'laundry'], {
        size: 'https://cdn.example/both.jpg',
        laundry: 'https://cdn.example/both.jpg',
      }),
      'https://cdn.example/both.jpg'
    )
    assert.equal(
      resolveStoredImageLocSheet(['size', 'laundry'], { size: 'https://cdn.example/size.jpg' }),
      null
    )
  })

  it('marks a measurement table as size and a wash label as laundry', () => {
    assert.deepEqual(
      imageLocSheetKinds([
        { text: '尺码表', bbox: [0, 0, 10, 10] },
        { text: '胸围', bbox: [0, 20, 10, 10] },
        { text: '衣长', bbox: [0, 40, 10, 10] },
        { text: 'S', bbox: [20, 20, 10, 10] },
        { text: '82cm', bbox: [40, 20, 10, 10] },
        { text: '88cm', bbox: [40, 40, 10, 10] },
        { text: 'M', bbox: [20, 40, 10, 10] },
        { text: '90cm', bbox: [60, 20, 10, 10] },
      ]),
      ['size']
    )
    assert.deepEqual(
      imageLocSheetKinds([
        { text: '洗涤说明', bbox: [0, 0, 10, 10] },
        { text: '手洗', bbox: [0, 20, 10, 10] },
      ]),
      ['laundry']
    )
  })
})
