import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  inventoryCounterfeitCleared,
  inventoryImageEmbedLocalizedSql,
  inventoryImageReadyForImageEmbedding,
  inventoryReadyForVectors,
} from './inventory-image-embedding-gate'

describe('inventory image embedding waits for localization', () => {
  it('allows only localized and skipped products', () => {
    assert.equal(inventoryImageReadyForImageEmbedding('localized'), true)
    assert.equal(inventoryImageReadyForImageEmbedding(' skipped '), true)
    assert.equal(inventoryImageReadyForImageEmbedding('LOCALIZED'), true)
    assert.equal(inventoryImageReadyForImageEmbedding('pending'), false)
    assert.equal(inventoryImageReadyForImageEmbedding('processing'), false)
    assert.equal(inventoryImageReadyForImageEmbedding('failed'), false)
    assert.equal(inventoryImageReadyForImageEmbedding(''), false)
    assert.equal(inventoryImageReadyForImageEmbedding(null), false)
    assert.equal(inventoryImageReadyForImageEmbedding(undefined), false)
  })

  it('keeps the SQL filter on the same two statuses', () => {
    const aliased = inventoryImageEmbedLocalizedSql()
    const bare = inventoryImageEmbedLocalizedSql('')
    assert.match(aliased, /mpi\.image_localization_status/)
    assert.match(aliased, /'localized', 'skipped'/)
    assert.equal(bare.includes('mpi.'), false)
    assert.match(bare, /image_localization_status/)
  })

  it('waits for a clean counterfeit check and localization before vectors', () => {
    assert.equal(inventoryCounterfeitCleared(null), false)
    assert.equal(inventoryCounterfeitCleared({ checked: true, risk: false }), true)
    assert.equal(inventoryCounterfeitCleared({ checked: true, risk: true }), false)
    assert.equal(
      inventoryReadyForVectors({
        image_localization_status: 'localized',
        counterfeit_risk: { checked: true, risk: false },
      }),
      true
    )
    assert.equal(
      inventoryReadyForVectors({
        image_localization_status: 'pending',
        counterfeit_risk: { checked: true, risk: false },
      }),
      false
    )
  })
})
