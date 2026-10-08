import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildWeddingGuestPackQuota,
  buildWeddingGuestSideQuotas,
  canAddWeddingGuests,
  weddingGuestPackBlockedMessage,
  weddingGuestPackUpgradeVnd,
} from './wedding-guest-pack'

describe('wedding guest packs', () => {
  it('keeps three guests free and blocks the fourth', () => {
    assert.equal(canAddWeddingGuests(2, 1, null), true)
    assert.equal(canAddWeddingGuests(3, 1, null), false)
    assert.equal(canAddWeddingGuests(0, 3, null), true)
    assert.equal(canAddWeddingGuests(0, 4, null), false)
  })

  it('charges the full price from the free tier and only the difference on upgrade', () => {
    assert.equal(weddingGuestPackUpgradeVnd(null, 'p50'), 149_000)
    assert.equal(weddingGuestPackUpgradeVnd(null, 'p100'), 199_000)
    assert.equal(weddingGuestPackUpgradeVnd(null, 'unlimited'), 299_000)
    assert.equal(weddingGuestPackUpgradeVnd('p50', 'p100'), 50_000)
    assert.equal(weddingGuestPackUpgradeVnd('p50', 'unlimited'), 150_000)
    assert.equal(weddingGuestPackUpgradeVnd('p100', 'unlimited'), 100_000)
    assert.equal(weddingGuestPackUpgradeVnd('p100', 'p50'), 0)
    assert.equal(weddingGuestPackUpgradeVnd('unlimited', 'unlimited'), 0)
  })

  it('hides a pack that cannot cover guests already on the list', () => {
    const quota = buildWeddingGuestPackQuota(null, 80)
    const p50 = quota.offers.find((offer) => offer.id === 'p50')
    const p100 = quota.offers.find((offer) => offer.id === 'p100')
    const unlimited = quota.offers.find((offer) => offer.id === 'unlimited')
    assert.equal(p50?.available, false)
    assert.equal(p100?.available, true)
    assert.equal(p100?.payVnd, 199_000)
    assert.equal(unlimited?.available, true)
    assert.equal(unlimited?.payVnd, 299_000)
  })

  it('caps 50 guests on the small pack and leaves the large pack open', () => {
    assert.equal(canAddWeddingGuests(49, 1, 'p50'), true)
    assert.equal(canAddWeddingGuests(50, 1, 'p50'), false)
    assert.equal(canAddWeddingGuests(100, 1, 'p100'), false)
    assert.equal(canAddWeddingGuests(400, 20, 'unlimited'), true)
  })

  it('tells the free tier to pick a pack from guest four', () => {
    const message = weddingGuestPackBlockedMessage(buildWeddingGuestPackQuota(null, 3), 'groom')
    assert.match(message, /Nhà trai đã dùng 3 khách dùng thử/)
    assert.match(message, /gói nhà trai/)
    assert.match(message, /khách thứ 4/)
  })

  it('keeps groom and bride trials and upgrades on separate packs', () => {
    const trial = buildWeddingGuestSideQuotas({
      groomPack: null,
      bridePack: null,
      groomCount: 3,
      brideCount: 0,
    })
    assert.equal(canAddWeddingGuests(trial.groom.guestCount, 1, trial.groom.packId), false)
    assert.equal(canAddWeddingGuests(trial.bride.guestCount, 3, trial.bride.packId), true)
    assert.equal(canAddWeddingGuests(trial.bride.guestCount, 1, trial.bride.packId), true)

    const paid = buildWeddingGuestSideQuotas({
      groomPack: 'p50',
      bridePack: null,
      groomCount: 10,
      brideCount: 3,
    })
    assert.equal(paid.groom.offers.find((offer) => offer.id === 'p100')?.payVnd, 50_000)
    assert.equal(paid.bride.offers.find((offer) => offer.id === 'p50')?.payVnd, 149_000)
    assert.equal(paid.bride.offers.find((offer) => offer.id === 'p100')?.payVnd, 199_000)
    assert.equal(canAddWeddingGuests(paid.bride.guestCount, 1, paid.bride.packId), false)
    assert.equal(canAddWeddingGuests(paid.groom.guestCount, 1, paid.groom.packId), true)
  })
})
