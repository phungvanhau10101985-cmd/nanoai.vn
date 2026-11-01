import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { WEDDING_SAMPLE_CARDS, weddingSampleGalleryThumb } from './wedding-sample-cards'
import { nextWeddingMusicMix, shuffleWeddingMusicUrls, weddingMusicQueue } from './wedding-music-library'

test('music queue drops blanks and duplicates', () => {
  assert.deepEqual(weddingMusicQueue([' a.mp3 ', '', 'a.mp3', 'b.mp3']), ['a.mp3', 'b.mp3'])
})

test('shuffle keeps every track', () => {
  const urls = ['a.mp3', 'b.mp3', 'c.mp3']
  assert.deepEqual(shuffleWeddingMusicUrls(urls, () => 0), ['b.mp3', 'c.mp3', 'a.mp3'])
})

test('each theme gallery thumb is a small file', () => {
  for (const sample of WEDDING_SAMPLE_CARDS) {
    const file = path.join(process.cwd(), 'public', weddingSampleGalleryThumb(sample).replace(/^\//, ''))
    assert.equal(existsSync(file), true, sample.id)
    assert.ok(statSync(file).size < 120_000, sample.id)
  }
})

test('mix advances, then reshuffles without reopening on the last track', () => {
  const order = ['a.mp3', 'b.mp3', 'c.mp3']
  assert.deepEqual(nextWeddingMusicMix(order, 0, () => 0), { order, index: 1 })
  const wrapped = nextWeddingMusicMix(order, 2, () => 0)
  assert.equal(wrapped.index, 0)
  assert.notEqual(wrapped.order[0], 'c.mp3')
  assert.deepEqual([...wrapped.order].sort(), [...order].sort())
})
