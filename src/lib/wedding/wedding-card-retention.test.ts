import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isWeddingCardExpired,
  latestWeddingCeremonyIso,
  weddingCardRemovalIso,
  weddingGuestPackPurchaseBody,
} from './wedding-card-retention'

test('lễ muộn hơn giữa hai nhà là mốc giữ thiệp', () => {
  assert.equal(latestWeddingCeremonyIso(['2026-10-01', null, '2026-10-03']), '2026-10-03')
  assert.equal(latestWeddingCeremonyIso([null, '', null]), null)
})

test('thiệp còn đến hết 17 ngày sau lễ và gỡ vào ngày thứ 18', () => {
  assert.equal(weddingCardRemovalIso('2026-10-01'), '2026-10-19')
  assert.equal(isWeddingCardExpired('2026-10-01', '2026-10-18'), false)
  assert.equal(isWeddingCardExpired('2026-10-01', '2026-10-19'), true)
  assert.equal(isWeddingCardExpired(null, '2026-10-19'), false)
})

test('thông báo mua gói ghi ngày xóa khi đã có ngày lễ', () => {
  const body = weddingGuestPackPurchaseBody({
    groomName: 'Minh',
    brideName: 'Lan',
    ceremonyIso: '2026-10-01',
  })
  assert.match(body, /Minh & Lan/)
  assert.match(body, /19\/10\/2026/)
  assert.match(body, /01\/10\/2026/)
  assert.match(body, /Ảnh nền và nhạc dùng chung vẫn giữ trong kho/)
})
