import assert from 'node:assert/strict'
import test from 'node:test'
import { creditQrTiles, isCreditPaymentQrImageUrl } from '@/lib/payment-qr-image'

test('allows only SePay and VietQR image hosts', () => {
  assert.equal(
    isCreditPaymentQrImageUrl('https://qr.sepay.vn/img?acc=1&bank=MB&amount=10000&des=SEVQR'),
    true,
  )
  assert.equal(isCreditPaymentQrImageUrl('https://img.vietqr.io/image/MB-1-compact.png'), true)
  assert.equal(isCreditPaymentQrImageUrl('https://api.vietqr.io/image/MB-1-compact.png'), true)
  assert.equal(isCreditPaymentQrImageUrl('http://qr.sepay.vn/img'), false)
  assert.equal(isCreditPaymentQrImageUrl('https://user:pass@qr.sepay.vn/img'), false)
  assert.equal(isCreditPaymentQrImageUrl('https://evil.example/qr.png'), false)
  assert.equal(isCreditPaymentQrImageUrl('https://127.0.0.1/qr.png'), false)
})

test('tiles cover the bitmap exactly once', () => {
  const tiles = creditQrTiles(400, 640, 4, 8)
  assert.equal(tiles.length, 32)
  const seen = new Set<string>()
  for (const tile of tiles) {
    assert.ok(tile.w > 0 && tile.h > 0)
    for (let y = tile.y; y < tile.y + tile.h; y += 1) {
      for (let x = tile.x; x < tile.x + tile.w; x += 1) {
        const key = `${x},${y}`
        assert.equal(seen.has(key), false)
        seen.add(key)
      }
    }
  }
  assert.equal(seen.size, 400 * 640)
})
