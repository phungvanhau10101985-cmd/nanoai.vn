import assert from 'node:assert/strict'
import test from 'node:test'
import { weddingBackgroundPlateUrls } from './wedding-background-plates'

test('the selected background is the only plate, other faces stay out', () => {
  const urls = weddingBackgroundPlateUrls('https://cdn.example/master.jpg', [
    { type: 'thanks', imageUrl: 'https://cdn.example/thanks.jpg', createdAt: '2026-02-01T00:00:00.000Z' },
    { type: 'master', imageUrl: 'https://cdn.example/old-master.jpg', createdAt: '2026-01-01T00:00:00.000Z' },
    { type: 'cover', imageUrl: 'https://cdn.example/cover.jpg', createdAt: '2026-03-01T00:00:00.000Z' },
    { type: 'album', imageUrl: 'https://cdn.example/album.jpg', createdAt: '2026-05-01T00:00:00.000Z' },
    { type: 'event', imageUrl: 'https://cdn.example/event-new.jpg', createdAt: '2026-04-02T00:00:00.000Z' },
    { type: 'event', imageUrl: 'https://cdn.example/event-old.jpg', createdAt: '2026-04-01T00:00:00.000Z' },
  ])
  assert.deepEqual(urls, ['https://cdn.example/master.jpg'])
})

test('without a selected image, only the newest master is used', () => {
  assert.deepEqual(
    weddingBackgroundPlateUrls('', [
      { type: 'album', imageUrl: 'https://cdn.example/album.jpg', createdAt: '2026-06-01T00:00:00.000Z' },
      { type: 'master', imageUrl: 'https://cdn.example/older.jpg', createdAt: '2026-01-01T00:00:00.000Z' },
      { type: 'master', imageUrl: 'https://cdn.example/newer.jpg', createdAt: '2026-03-01T00:00:00.000Z' },
    ]),
    ['https://cdn.example/newer.jpg'],
  )
})

test('a card with only the master plate still returns that plate', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('https://cdn.example/master.jpg', []), [
    'https://cdn.example/master.jpg',
  ])
})
