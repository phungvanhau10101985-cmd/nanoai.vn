import assert from 'node:assert/strict'
import test from 'node:test'
import {
  INVITATION_OCCASION_GROUPS,
  INVITATION_OCCASION_KEYS,
  applyInvitationOccasionPublicCopy,
  invitationEditorCopy,
  invitationGiftBlockedMessage,
  invitationOccasionShape,
  invitationOccasionShapeChangeNote,
  invitationSeoCopy,
  normalizeInvitationOccasion,
  WEDDING_GIFT_BLOCKED_MESSAGE,
} from './invitation-occasion'
import { isInvitationGiftReady } from './wedding-gift-vietqr'
import { buildWeddingPublicDescription, buildWeddingPublicJsonLd, buildWeddingPublicTitle } from './wedding-public-seo'

const gift = {
  groomGiftBankId: 'VCB',
  groomGiftAccountNo: '0123',
  groomGiftAccountName: 'HAU',
  brideGiftBankId: '',
  brideGiftAccountNo: '',
  brideGiftAccountName: '',
}

test('unknown occasion stays wedding', () => {
  assert.equal(normalizeInvitationOccasion(''), 'wedding')
  assert.equal(normalizeInvitationOccasion('nope'), 'wedding')
  assert.equal(invitationOccasionShape(null), 'couple')
  assert.equal(invitationEditorCopy('wedding').stepTitle, '2. Nhập thông tin cưới')
  assert.equal(invitationEditorCopy('wedding').primaryName, 'Tên chú rể')
  assert.equal(invitationEditorCopy('wedding').secondaryName, 'Tên cô dâu')
  assert.equal(invitationEditorCopy('wedding').venueTitle, 'Nhà trai và nhà gái')
  assert.equal(invitationEditorCopy('wedding').previewEyebrow, 'Wedding Invitation')
})

test('every listed occasion has a shape and a vietnamese label', () => {
  const grouped = INVITATION_OCCASION_GROUPS.flatMap((group) => group.keys)
  assert.deepEqual([...grouped].sort(), [...INVITATION_OCCASION_KEYS].sort())
  assert.equal(new Set(grouped).size, grouped.length)
  for (const key of INVITATION_OCCASION_KEYS) {
    const copy = invitationEditorCopy(key)
    assert.ok(copy.label.trim())
    assert.ok(copy.stepTitle.startsWith('2. '))
    assert.equal(invitationOccasionShape(key), key === 'wedding' || key === 'engagement' || key === 'anniversary' ? 'couple' : 'single')
    assert.equal(invitationSeoCopy(key).title.startsWith('Thiệp mời'), true)
  }
})

test('shape change only asks when couple and single swap', () => {
  assert.equal(invitationOccasionShapeChangeNote('wedding', 'engagement'), null)
  assert.match(invitationOccasionShapeChangeNote('wedding', 'birthday') ?? '', /Tên chú rể/)
  assert.match(invitationOccasionShapeChangeNote('birthday', 'wedding') ?? '', /Người được mừng/)
})

test('wedding public copy is unchanged and other occasions drop wedding roles', () => {
  const tx = { groomRole: 'Chú rể', brideRole: 'Cô dâu', dateFallback: 'Ngày cưới' }
  assert.equal(applyInvitationOccasionPublicCopy(tx, 'wedding', 'vi'), tx)
  const birthday = applyInvitationOccasionPublicCopy(tx, 'birthday', 'vi')
  assert.equal(birthday.groomRole, 'Sinh nhật')
  assert.equal(birthday.dateFallback, 'Ngày sinh nhật')
  assert.equal(applyInvitationOccasionPublicCopy(tx, 'birthday', 'en').dateFallback, 'Birthday')
  assert.doesNotMatch(birthday.dateFallback, /cưới/)
})

test('single gift needs one account; wedding still needs both', () => {
  assert.equal(isInvitationGiftReady({ ...gift, occasionKey: 'birthday' }), true)
  assert.equal(isInvitationGiftReady({ ...gift, occasionKey: 'wedding' }), false)
  assert.equal(invitationGiftBlockedMessage('wedding'), WEDDING_GIFT_BLOCKED_MESSAGE)
  assert.match(invitationGiftBlockedMessage('birthday'), /một|VietQR/i)
  assert.doesNotMatch(invitationGiftBlockedMessage('grand_opening'), /cô dâu/)
})

test('seo title stays the wedding sentence and other types do not say lễ cưới', () => {
  const card = {
    groomName: 'Hậu',
    brideName: 'Lan',
    weddingDate: '2026-10-10',
    weddingTime: '11:00',
    venue: 'Nhà hàng Sen',
    mapUrl: '',
    invitationText: '',
    masterImageUrl: null,
    groomImageUrl: '',
    brideImageUrl: '',
    occasionKey: 'wedding' as const,
  }
  assert.equal(buildWeddingPublicTitle(card), 'Thiệp mời cưới Hậu & Lan')
  assert.equal(buildWeddingPublicJsonLd(card, 'https://nanoai.vn/x').name, 'Lễ cưới Hậu & Lan')
  const birthday = { ...card, occasionKey: 'birthday' as const, brideName: '' }
  assert.equal(buildWeddingPublicTitle(birthday), 'Thiệp mời sinh nhật Hậu')
  assert.doesNotMatch(buildWeddingPublicDescription(birthday), /lễ cưới/)
  assert.match(String(buildWeddingPublicJsonLd(birthday, 'https://nanoai.vn/x').name), /sinh nhật/i)
})
