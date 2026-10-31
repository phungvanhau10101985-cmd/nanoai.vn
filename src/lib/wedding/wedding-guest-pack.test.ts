import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildWeddingGuestPackQuota,
  buildWeddingGuestSideQuotas,
  canAddWeddingGuests,
  weddingGuestPackBlockedMessage,
  weddingGuestPackUpgradeVnd,
  weddingGuestRowShowsInviteLink,
} from './wedding-guest-pack'

describe('wedding guest packs', () => {
  it('shows invite links for the first three guests until a pack is bought', () => {
    assert.equal(weddingGuestRowShowsInviteLink(0, null), true)
    assert.equal(weddingGuestRowShowsInviteLink(2, null), true)
    assert.equal(weddingGuestRowShowsInviteLink(3, null), false)
    assert.equal(weddingGuestRowShowsInviteLink(3, 'p50'), true)
    assert.equal(weddingGuestRowShowsInviteLink(99, 'p50'), true)
    assert.equal(weddingGuestRowShowsInviteLink(100, 'p50'), false)
    assert.equal(weddingGuestRowShowsInviteLink(500, 'unlimited'), true)
  })

  it('lets the free tier keep building the list past three guests', () => {
    assert.equal(canAddWeddingGuests(2, 1, null), true)
    assert.equal(canAddWeddingGuests(3, 1, null), true)
    assert.equal(canAddWeddingGuests(0, 3, null), true)
    assert.equal(canAddWeddingGuests(0, 40, null), true)
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
    const quota = buildWeddingGuestPackQuota(null, 150)
    const p50 = quota.offers.find((offer) => offer.id === 'p50')
    const p100 = quota.offers.find((offer) => offer.id === 'p100')
    const unlimited = quota.offers.find((offer) => offer.id === 'unlimited')
    assert.equal(p50?.available, false)
    assert.equal(p100?.available, true)
    assert.equal(p100?.payVnd, 199_000)
    assert.equal(unlimited?.available, true)
    assert.equal(unlimited?.payVnd, 299_000)
  })

  it('caps 100 guests on the 149k pack and 200 on the 199k pack', () => {
    assert.equal(canAddWeddingGuests(99, 1, 'p50'), true)
    assert.equal(canAddWeddingGuests(100, 1, 'p50'), false)
    assert.equal(canAddWeddingGuests(199, 1, 'p100'), true)
    assert.equal(canAddWeddingGuests(200, 1, 'p100'), false)
    assert.equal(canAddWeddingGuests(400, 20, 'unlimited'), true)
  })

  it('tells the free tier that later guests need a pack to show links', () => {
    const message = weddingGuestPackBlockedMessage(buildWeddingGuestPackQuota(null, 3), 'groom')
    assert.match(message, /Nhà trai chưa mua gói/)
    assert.match(message, /3 khách đầu hiện link/)
    assert.match(message, /gói nhà trai/)
  })

  it('keeps groom and bride trials and upgrades on separate packs', () => {
    const trial = buildWeddingGuestSideQuotas({
      groomPack: null,
      bridePack: null,
      groomCount: 3,
      brideCount: 0,
    })
    assert.equal(canAddWeddingGuests(trial.groom.guestCount, 1, trial.groom.packId), true)
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
    assert.equal(canAddWeddingGuests(paid.bride.guestCount, 1, paid.bride.packId), true)
    assert.equal(canAddWeddingGuests(paid.groom.guestCount, 1, paid.groom.packId), true)
  })
})
