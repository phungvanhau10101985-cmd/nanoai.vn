import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseWarehouseSourceSkuParts, resolveWarehouseIntakeHints, warehouseColorHintFromGallery } from './warehouse-source-sku'

describe('parseWarehouseSourceSkuParts', () => {
  it('treats A…/4 as color gallery index, not size', () => {
    assert.deepEqual(parseWarehouseSourceSkuParts('A1234567890/4'), {
      kind: '1688',
      offerId: '1234567890',
      size: '',
      colorImageIndex: 3,
    })
  })

  it('treats A…/45/4 as size plus color gallery index', () => {
    assert.deepEqual(parseWarehouseSourceSkuParts('A1234567890/45/4'), {
      kind: '1688',
      offerId: '1234567890',
      size: '45',
      colorImageIndex: 3,
    })
  })

  it('parses Tmall T prefix', () => {
    assert.equal(parseWarehouseSourceSkuParts('T998877/2').kind, 'tmall')
    assert.equal(parseWarehouseSourceSkuParts('T998877/2').colorImageIndex, 1)
  })

  it('maps color index onto gallery URLs', () => {
    assert.equal(warehouseColorHintFromGallery(['a.jpg', 'b.jpg', 'c.jpg'], 1), 'b.jpg')
  })

  it('resolves intake hints from A/T gallery index', () => {
    const hints = resolveWarehouseIntakeHints({
      sku: 'A111/4',
      colors: ['Đỏ', 'Xanh', 'Vàng', 'Đen'],
      sizes: ['S', 'M'],
      galleryUrls: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'],
    })
    assert.equal(hints.color, 'Đen')
    assert.equal(hints.size, '')
    assert.equal(hints.colorImageUrl, 'd.jpg')
  })
})
