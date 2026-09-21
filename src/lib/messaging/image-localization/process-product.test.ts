import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyImageLocResultsToRow } from './process-product'
import type { ImageProcessResult } from './image-localization-types'

function deleted(url: string): ImageProcessResult {
  return { original_url: url, final_url: null, status: 'deleted', message: 'Xóa theo classifier' }
}

function kept(url: string): ImageProcessResult {
  return { original_url: url, final_url: url, status: 'kept', message: 'Không cần xử lý' }
}

function processed(url: string, next: string): ImageProcessResult {
  return { original_url: url, final_url: next, status: 'processed', message: 'Đã dịch' }
}

describe('applyImageLocResultsToRow cover fallback', () => {
  it('uses the first remaining gallery image when the cover is deleted', () => {
    const patched = applyImageLocResultsToRow(
      {
        image_url: 'https://cdn.example/cover-promo.jpg',
        gallery_urls: ['https://cdn.example/g1.jpg', 'https://cdn.example/g2.jpg'],
      },
      {
        'https://cdn.example/cover-promo.jpg': deleted('https://cdn.example/cover-promo.jpg'),
        'https://cdn.example/g1.jpg': kept('https://cdn.example/g1.jpg'),
        'https://cdn.example/g2.jpg': kept('https://cdn.example/g2.jpg'),
      }
    )
    assert.equal(patched.image_url, 'https://cdn.example/g1.jpg')
    assert.deepEqual(patched.gallery_urls, ['https://cdn.example/g1.jpg', 'https://cdn.example/g2.jpg'])
  })

  it('skips a deleted first gallery image and uses the next kept one', () => {
    const patched = applyImageLocResultsToRow(
      {
        image_url: 'https://cdn.example/cover.jpg',
        gallery_urls: ['https://cdn.example/cover.jpg', 'https://cdn.example/g2.jpg'],
      },
      {
        'https://cdn.example/cover.jpg': deleted('https://cdn.example/cover.jpg'),
        'https://cdn.example/g2.jpg': kept('https://cdn.example/g2.jpg'),
      }
    )
    assert.equal(patched.image_url, 'https://cdn.example/g2.jpg')
    assert.deepEqual(patched.gallery_urls, ['https://cdn.example/g2.jpg'])
  })

  it('keeps a processed cover and does not replace it with gallery', () => {
    const patched = applyImageLocResultsToRow(
      {
        image_url: 'https://cdn.example/cover.jpg',
        gallery_urls: ['https://cdn.example/g1.jpg'],
      },
      {
        'https://cdn.example/cover.jpg': processed(
          'https://cdn.example/cover.jpg',
          'https://cdn.nanoai/localized-cover.jpg'
        ),
        'https://cdn.example/g1.jpg': kept('https://cdn.example/g1.jpg'),
      }
    )
    assert.equal(patched.image_url, 'https://cdn.nanoai/localized-cover.jpg')
  })

  it('leaves cover empty when gallery is also deleted', () => {
    const patched = applyImageLocResultsToRow(
      {
        image_url: 'https://cdn.example/cover.jpg',
        gallery_urls: ['https://cdn.example/g1.jpg'],
      },
      {
        'https://cdn.example/cover.jpg': deleted('https://cdn.example/cover.jpg'),
        'https://cdn.example/g1.jpg': deleted('https://cdn.example/g1.jpg'),
      }
    )
    assert.equal(patched.image_url, '')
    assert.deepEqual(patched.gallery_urls, [])
  })
})
