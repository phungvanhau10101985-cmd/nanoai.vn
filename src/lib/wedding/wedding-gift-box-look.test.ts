import assert from 'node:assert/strict'
import test from 'node:test'
import { WEDDING_BACKGROUND_PRESETS } from './wedding-background-presets'
import { findWeddingSampleCard } from './wedding-sample-cards'
import { weddingGiftBoxLook } from './wedding-gift-box-look'

test('each ready background has its own gift box, and red themes keep the lacquer box', () => {
  const ids = WEDDING_BACKGROUND_PRESETS.map((preset) => weddingGiftBoxLook(preset.id).id)
  assert.equal(new Set(ids).size, ids.length - 1)
  assert.equal(weddingGiftBoxLook('long-phung-do').id, 'lacquer')
  assert.equal(weddingGiftBoxLook('do-son').mark, 'double-happiness')
  assert.equal(weddingGiftBoxLook('song-hy-do').id, 'song-hy')
  assert.equal(weddingGiftBoxLook('song-hy-do').mark, 'double-happiness')
  assert.equal(weddingGiftBoxLook('hoa-moc-xanh').mark, 'leaf')
  assert.equal(weddingGiftBoxLook('hoa-moc-xanh').scatter, 'none')
  assert.equal(weddingGiftBoxLook('to-duyen-xanh').id, 'sage')
  assert.equal(weddingGiftBoxLook('to-duyen-xanh').mark, 'leaf')
  assert.equal(weddingGiftBoxLook('to-duyen-xanh').scatter, 'none')
  assert.equal(weddingGiftBoxLook('do-dam').id, 'burgundy')
  assert.equal(weddingGiftBoxLook('do-dam').mark, 'rose')
  assert.equal(weddingGiftBoxLook('do-dam').scatter, 'none')
  assert.equal(weddingGiftBoxLook('sen-vang').mark, 'lotus')
  assert.equal(weddingGiftBoxLook('toi-gian-nau').mark, 'ring')
  assert.equal(weddingGiftBoxLook('vuon-kinh-hong').scatter, 'pearl')
  assert.notEqual(weddingGiftBoxLook('hong-ngoc-trai').edge, weddingGiftBoxLook('vuon-hong-troi').edge)
  assert.equal(weddingGiftBoxLook('').id, 'lacquer')
  assert.equal(weddingGiftBoxLook('missing').id, 'lacquer')
  assert.equal(weddingGiftBoxLook('ai-floral').id, 'blush')
  assert.equal(weddingGiftBoxLook('ai-luxury').id, 'lotus')
  assert.equal(weddingGiftBoxLook('ai-modern').id, 'charcoal')
  assert.equal(weddingGiftBoxLook('ai-traditional_vietnamese').id, 'lacquer')
  assert.equal(weddingGiftBoxLook(undefined, findWeddingSampleCard('kho-hong-buom')?.libraryImageUrl).id, 'blush')
  assert.equal(weddingGiftBoxLook(undefined, findWeddingSampleCard('kho-sen-hong')?.libraryImageUrl).id, 'lotus')
  assert.equal(weddingGiftBoxLook(undefined, findWeddingSampleCard('kho-mau-don')?.libraryImageUrl).id, 'burgundy')
  assert.equal(weddingGiftBoxLook(undefined, findWeddingSampleCard('kho-phung-do')?.libraryImageUrl).id, 'lacquer')
})
