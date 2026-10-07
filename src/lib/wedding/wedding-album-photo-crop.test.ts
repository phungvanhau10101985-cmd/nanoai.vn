import assert from 'node:assert/strict'
import test from 'node:test'
import {
  albumPhotoFrameStyle,
  mergeWeddingSectionConfig,
  parseWeddingSectionConfig,
  remapAlbumPhotoCrops,
  resolveAlbumPhotoFrame,
  shiftAlbumPhotoCropsAfterRemove,
  upsertAlbumPhotoCrop,
} from './wedding-section-config'

test('album photo crop round-trips by index', () => {
  const raw = mergeWeddingSectionConfig('{}', {
    albumPhotoCrops: upsertAlbumPhotoCrop(undefined, 1, { x: 40, y: 22, scale: 1.5 }),
  })
  const parsed = parseWeddingSectionConfig(raw)
  assert.deepEqual(parsed.albumPhotoCrops, [{ index: 1, x: 40, y: 22, scale: 1.5 }])
  assert.deepEqual(resolveAlbumPhotoFrame(parsed.albumPhotoCrops, 1), { x: 40, y: 22, scale: 1.5 })
  assert.equal(albumPhotoFrameStyle(resolveAlbumPhotoFrame(parsed.albumPhotoCrops, 1)).transform, 'scale(1.5)')
  assert.equal(albumPhotoFrameStyle({ x: 50, y: 0, scale: 1 }).objectPosition, '50% 0%')
})

test('removing and reordering album photos keeps each crop with its url', () => {
  const crops = upsertAlbumPhotoCrop(
    upsertAlbumPhotoCrop(undefined, 0, { x: 10, y: 20, scale: 1.2 }),
    2,
    { x: 80, y: 30, scale: 2 },
  )
  const shifted = shiftAlbumPhotoCropsAfterRemove(crops, 1)
  assert.deepEqual(shifted, [
    { index: 0, x: 10, y: 20, scale: 1.2 },
    { index: 1, x: 80, y: 30, scale: 2 },
  ])
  const remapped = remapAlbumPhotoCrops(['a', 'b', 'c'], crops, ['c', 'a'])
  assert.deepEqual(remapped, [
    { index: 0, x: 80, y: 30, scale: 2 },
    { index: 1, x: 10, y: 20, scale: 1.2 },
  ])
})
