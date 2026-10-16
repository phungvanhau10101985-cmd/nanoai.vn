import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveWeddingAlbumLayoutId, WEDDING_ALBUM_GRID_SLOTS, WEDDING_ALBUM_LAYOUTS } from './wedding-album-layouts'

test('grid layout is a selectable 2 by 2 album option', () => {
  assert.equal(WEDDING_ALBUM_GRID_SLOTS, 4)
  assert.equal(resolveWeddingAlbumLayoutId('grid'), 'grid')
  assert.equal(WEDDING_ALBUM_LAYOUTS.find((layout) => layout.id === 'grid')?.label.vi, 'Lưới 2×2')
  assert.equal(resolveWeddingAlbumLayoutId('not-a-layout'), 'coverflow')
})
