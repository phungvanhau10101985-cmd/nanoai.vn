import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bunnyImageHostsForDelete,
  collectPartnerInventoryImageUrls,
  inventoryImageUrlToBunnyStoragePath,
  resolveBunnyDeletePathsFromUrls,
} from '@/lib/messaging/inventory-bunny-delete'

const OUR_CDN = 'https://cdn.nanoai.vn'

function withCdnEnv<T>(fn: () => T): T {
  const prev = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL
  const prevPub = process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL
  process.env.BUNNY_STORAGE_PUBLIC_BASE_URL = OUR_CDN
  process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL = OUR_CDN
  try {
    return fn()
  } finally {
    if (prev === undefined) delete process.env.BUNNY_STORAGE_PUBLIC_BASE_URL
    else process.env.BUNNY_STORAGE_PUBLIC_BASE_URL = prev
    if (prevPub === undefined) delete process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL
    else process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL = prevPub
  }
}

test('collects main / gallery / detail / color / localization URLs', () => {
  const urls = collectPartnerInventoryImageUrls({
    image_url: 'https://cdn.nanoai.vn/messaging-partner/p1/main.jpg',
    gallery_urls: ['https://cdn.nanoai.vn/messaging-partner/p1/g1.jpg', ''],
    detail_image_urls: ['https://cdn.nanoai.vn/localized-images/p1/d1.jpg'],
    colors_json: [{ name: 'Đen', img: 'https://cdn.nanoai.vn/messaging-partner/p1/black.jpg' }],
    product_info_json: {
      image_localization: {
        'https://img.alicdn.com/old.jpg': {
          original_url: 'https://img.alicdn.com/old.jpg',
          final_url: 'https://cdn.nanoai.vn/localized-images/p1/vi.jpg',
        },
      },
    },
  })
  assert.ok(urls.includes('https://cdn.nanoai.vn/messaging-partner/p1/main.jpg'))
  assert.ok(urls.includes('https://cdn.nanoai.vn/messaging-partner/p1/g1.jpg'))
  assert.ok(urls.includes('https://cdn.nanoai.vn/localized-images/p1/d1.jpg'))
  assert.ok(urls.includes('https://cdn.nanoai.vn/messaging-partner/p1/black.jpg'))
  assert.ok(urls.includes('https://cdn.nanoai.vn/localized-images/p1/vi.jpg'))
  assert.ok(urls.includes('https://img.alicdn.com/old.jpg'))
})

test('extracts http URLs from description HTML', () => {
  const urls = collectPartnerInventoryImageUrls({
    description: '<p><img src="https://cdn.nanoai.vn/messaging-partner/p1/desc.jpg"></p>',
  })
  assert.ok(urls.includes('https://cdn.nanoai.vn/messaging-partner/p1/desc.jpg'))
})

test('only NanoAI Bunny hosts map to storage paths (not AliCDN, not 188 CDN)', () => {
  withCdnEnv(() => {
    const hosts = bunnyImageHostsForDelete()
    assert.equal(
      inventoryImageUrlToBunnyStoragePath('https://cdn.nanoai.vn/messaging-partner/p1/a.jpg', hosts),
      'messaging-partner/p1/a.jpg'
    )
    assert.equal(
      inventoryImageUrlToBunnyStoragePath('https://nanoai.b-cdn.net/localized-images/p1/b.jpg', hosts),
      'localized-images/p1/b.jpg'
    )
    assert.equal(
      inventoryImageUrlToBunnyStoragePath('https://img.alicdn.com/imgextra/i1/foo.jpg', hosts),
      null
    )
    assert.equal(
      inventoryImageUrlToBunnyStoragePath(
        'https://188comvn.b-cdn.net/site/localized-images/A1/A1-vi.jpg',
        hosts
      ),
      null
    )
    assert.equal(inventoryImageUrlToBunnyStoragePath('https://cdn.nanoai.vn/../etc/passwd', hosts), null)
  })
})

test('resolveBunnyDeletePathsFromUrls dedupes by storage path', () => {
  withCdnEnv(() => {
    const items = resolveBunnyDeletePathsFromUrls([
      'https://cdn.nanoai.vn/messaging-partner/p1/a.jpg',
      'https://cdn.nanoai.vn/messaging-partner/p1/a.jpg?v=2',
      'https://img.alicdn.com/skip.jpg',
    ])
    assert.equal(items.length, 1)
    assert.equal(items[0]?.storagePath, 'messaging-partner/p1/a.jpg')
  })
})
