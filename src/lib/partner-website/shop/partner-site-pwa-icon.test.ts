import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

test('shop PWA icons never fall back to NanoAI platform PNGs', () => {
  const src = readFileSync(join(here, 'partner-site-pwa-icon.ts'), 'utf8')
  assert.match(src, /letterTilePng/)
  assert.doesNotMatch(src, /icon-192x192/)
  assert.doesNotMatch(src, /icon-512x512/)
  assert.doesNotMatch(src, /apple-touch-icon\.png/)
})

test('shop brand icon candidates prefer favicon then logo', () => {
  const src = readFileSync(join(here, 'partner-site-pwa-icon.ts'), 'utf8')
  assert.match(src, /faviconUrl, input.logoUrl/)
  assert.match(src, /partnerShopIconFallbackLetter/)
})
