import assert from 'node:assert/strict'
import test from 'node:test'
import { parseWeddingSectionConfig } from './wedding-section-config'
import { linkSideInviteValue, ownSidePartyFields, sharedLetterFallbackForSide } from './wedding-side-invite-settings'

const card = {
  weddingDate: '2026-10-18',
  weddingTime: '16:30, Chủ nhật',
  partyStartTime: '18:00',
  venue: 'Nhà hàng Sen',
  mapUrl: 'https://maps.example/sen',
  invitationText: 'Trân trọng kính mời',
  eventTimeline: '16:30 Đón khách',
  dressCode: 'Tông kem',
  thankYouText: 'Xin cảm ơn',
  groomHometown: 'Ba Vì',
  brideHometown: '',
}

test('side form shows the shared letter when its own field is empty', () => {
  assert.equal(sharedLetterFallbackForSide(card, 'groom', 'WeddingDate'), '2026-10-18')
  assert.equal(sharedLetterFallbackForSide(card, 'groom', 'ReceptionTime'), '16:30')
  assert.equal(sharedLetterFallbackForSide(card, 'groom', 'Address'), 'Ba Vì')
  assert.equal(sharedLetterFallbackForSide(card, 'bride', 'Address'), 'Nhà hàng Sen')
  assert.equal(sharedLetterFallbackForSide(card, 'bride', 'Text'), 'Trân trọng kính mời')
  assert.equal(sharedLetterFallbackForSide(card, 'groom', 'EventTimeline'), '16:30 Đón khách')
})

test('legacy party facts are copied onto each house only once', () => {
  const source = {
    weddingDate: '2026-10-18',
    weddingTime: '16:30, Chủ nhật',
    partyStartTime: '18:00',
    venue: 'Nhà hàng Sen',
    mapUrl: 'https://maps.example/sen',
    eventTimeline: '16:30 Đón khách',
    groomHometown: 'Ba Vì',
    brideHometown: '',
    groomInviteWeddingDate: null,
    brideInviteWeddingDate: null,
    groomInviteReceptionTime: '',
    brideInviteReceptionTime: '',
    groomInvitePartyStartTime: '',
    brideInvitePartyStartTime: '',
    groomInviteAddress: '',
    brideInviteAddress: '',
    groomInviteMapUrl: '',
    brideInviteMapUrl: '',
    groomInviteEventTimeline: '',
    brideInviteEventTimeline: '',
    sectionConfig: '{}',
  } as Parameters<typeof ownSidePartyFields>[0]
  const owned = ownSidePartyFields(source)
  assert.equal(owned.groomInviteAddress, 'Ba Vì')
  assert.equal(owned.brideInviteAddress, 'Nhà hàng Sen')
  assert.equal(owned.groomInviteReceptionTime, '16:30')
  assert.equal(parseWeddingSectionConfig(owned.sectionConfig).sidePartyOwned, true)
  const cleared = ownSidePartyFields({ ...owned, brideInviteAddress: '' })
  assert.equal(cleared.brideInviteAddress, '')
})

test('matching the shared letter keeps the side field linked', () => {
  assert.equal(linkSideInviteValue('  Trân trọng kính mời  ', 'Trân trọng kính mời'), '')
  assert.equal(linkSideInviteValue('Lời riêng nhà trai', 'Trân trọng kính mời'), 'Lời riêng nhà trai')
})
