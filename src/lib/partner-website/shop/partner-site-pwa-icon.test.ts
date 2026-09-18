import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  PARTNER_SHOP_ICON_CANVAS_HEX,
  partnerShopBrandIconUrls,
  partnerShopIconFallbackLetter,
  rasterPartnerShopIconPng,
} from '@/lib/partner-website/shop/partner-site-pwa-icon'

const here = dirname(fileURLToPath(import.meta.url))

test('shop PWA icons never fall back to NanoAI platform PNGs', () => {
  const src = readFileSync(join(here, 'partner-site-pwa-icon.ts'), 'utf8')
  assert.match(src, /letterTilePng/)
  assert.doesNotMatch(src, /icon-192x192/)
  assert.doesNotMatch(src, /icon-512x512/)
  assert.doesNotMatch(src, /apple-touch-icon\.png/)
})

test('shop brand icon candidates prefer PWA avatar then favicon then logo', () => {
  assert.deepEqual(
    partnerShopBrandIconUrls({
      pwaIconUrl: 'https://cdn.example/pwa.png',
      faviconUrl: 'https://cdn.example/fav.png',
      logoUrl: 'https://cdn.example/logo.png',
    }),
    ['https://cdn.example/pwa.png', 'https://cdn.example/fav.png', 'https://cdn.example/logo.png']
  )
  assert.equal(partnerShopIconFallbackLetter('gudo.vn'), 'G')
})

test('transparent favicon keeps alpha instead of flattening onto primary', async () => {
  const mark = '#ea580c'
  const src = await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="18" fill="${mark}"/></svg>`
        ),
        gravity: 'centre',
      },
    ])
    .png()
    .toBuffer()

  const tab = await rasterPartnerShopIconPng({
    image: src,
    size: 32,
    maskable: false,
    letterColor: mark,
  })
  const corner = await sharp(tab).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer()
  assert.equal(corner[3], 0, 'tab favicon corner must stay transparent')

  const maskable = await rasterPartnerShopIconPng({
    image: src,
    size: 32,
    maskable: true,
    letterColor: mark,
  })
  const maskCorner = await sharp(maskable).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer()
  assert.equal(maskCorner[3], 255)
  assert.equal(maskCorner[0], 255)
  assert.equal(maskCorner[1], 255)
  assert.equal(maskCorner[2], 255)
})

test('letter fallback tile is white, not primary', async () => {
  const png = await rasterPartnerShopIconPng({
    image: null,
    size: 32,
    maskable: false,
    letterColor: '#ea580c',
    fallbackLetter: 'G',
  })
  const corner = await sharp(png).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer()
  assert.equal(PARTNER_SHOP_ICON_CANVAS_HEX, '#ffffff')
  assert.equal(corner[0], 255)
  assert.equal(corner[1], 255)
  assert.equal(corner[2], 255)
})
