import assert from 'node:assert/strict'
import test from 'node:test'
import {
  INVITATION_OCCASION_GROUPS,
  INVITATION_OCCASION_KEYS,
  applyInvitationCalendarCopy,
  applyInvitationCoverSectionDescription,
  applyInvitationGiftCopy,
  applyInvitationOccasionPublicCopy,
  invitationEventPhrase,
  invitationCoverPhotoCopy,
  invitationCardStructure,
  invitationEditorCopy,
  invitationGiftBlockedMessage,
  invitationOccasionShape,
  invitationShowsSecondVenue,
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

test('cover photo label matches each occasion', () => {
  assert.equal(invitationCoverPhotoCopy('wedding', 'vi').uploadLabel, 'Ảnh cặp đôi trên vỏ thiệp')
  assert.equal(invitationCoverPhotoCopy('engagement', 'vi').uploadLabel, 'Ảnh cặp đôi trên vỏ thiệp')
  assert.equal(invitationCoverPhotoCopy('anniversary', 'vi').redPresetLabel, 'Đỏ ảnh cặp đôi')
  assert.equal(invitationCoverPhotoCopy('birthday', 'vi').uploadLabel, 'Ảnh nhân vật chính trên vỏ thiệp')
  assert.equal(invitationCoverPhotoCopy('birthday', 'vi').alt, 'Ảnh nhân vật chính trên vỏ thiệp')
  assert.equal(invitationCoverPhotoCopy('full_month', 'vi').uploadLabel, 'Ảnh bé trên vỏ thiệp')
  assert.equal(invitationCoverPhotoCopy('first_birthday', 'vi').uploadLabel, 'Ảnh bé trên vỏ thiệp')
  assert.equal(invitationCoverPhotoCopy('longevity', 'vi').uploadLabel, 'Ảnh người mừng thọ trên vỏ thiệp')
  assert.equal(invitationCoverPhotoCopy('grand_opening', 'vi').uploadLabel, 'Ảnh cửa hàng trên vỏ thiệp')
  assert.equal(invitationCoverPhotoCopy('housewarming', 'vi').uploadLabel, 'Ảnh chủ nhà trên vỏ thiệp')
  assert.equal(invitationCoverPhotoCopy('gathering', 'vi').uploadLabel, 'Ảnh buổi tiệc trên vỏ thiệp')
  assert.equal(invitationCoverPhotoCopy('graduation', 'vi').uploadLabel, 'Ảnh tân cử nhân trên vỏ thiệp')
  assert.equal(invitationCoverPhotoCopy('ceremony', 'vi').uploadLabel, 'Ảnh sự kiện trên vỏ thiệp')
  const viDesc =
    'Chọn kiểu khung thiệp giữa màn «Mở thiệp» và thêm ảnh cặp đôi vào giữa — miễn phí, không tốn credit. Ảnh nền full màn dùng chung một ảnh nền chính.'
  const birthdayDesc = applyInvitationCoverSectionDescription(viDesc, 'birthday', 'vi')
  assert.match(birthdayDesc, /ảnh nhân vật chính/)
  assert.doesNotMatch(birthdayDesc, /cặp đôi/)
  assert.equal(applyInvitationCoverSectionDescription(viDesc, 'wedding', 'vi'), viDesc)
  const tx = { coverPhotoAlt: 'Ảnh cặp đôi trên vỏ thiệp', groomRole: 'Chú rể', dateFallback: 'Ngày cưới' }
  assert.equal(applyInvitationOccasionPublicCopy(tx, 'birthday', 'vi').coverPhotoAlt, 'Ảnh nhân vật chính trên vỏ thiệp')
  assert.equal(applyInvitationOccasionPublicCopy(tx, 'birthday', 'vi').guestInviteVenueGroom, 'Đến dự tiệc sinh nhật')
  assert.equal(invitationEventPhrase('birthday', 'vi'), 'tiệc sinh nhật')
  assert.equal(invitationEventPhrase('wedding', 'vi'), 'bữa cơm thân mật cùng gia đình')
  assert.equal(invitationEventPhrase('engagement', 'vi'), 'lễ đám hỏi')
  assert.equal(applyInvitationOccasionPublicCopy(tx, 'engagement', 'vi').guestInviteVenueGroom, 'Đến tại nhà trai')
  assert.equal(applyInvitationOccasionPublicCopy(tx, 'full_month', 'vi').guestInviteVenueGroom, 'Đến dự tiệc đầy tháng')
  assert.doesNotMatch(applyInvitationOccasionPublicCopy(tx, 'birthday', 'vi').guestInviteVenueGroom, /nhà trai/)
  assert.equal(applyInvitationOccasionPublicCopy(tx, 'wedding', 'vi'), tx)
  for (const key of INVITATION_OCCASION_KEYS) {
    for (const locale of ['vi', 'en', 'zh', 'ja', 'ko']) {
      const copy = invitationCoverPhotoCopy(key, locale)
      assert.ok(copy.uploadLabel.trim())
      assert.ok(copy.alt.trim())
      assert.ok(copy.sectionPhrase.trim())
      assert.ok(copy.redPresetLabel.trim())
      if (key !== 'wedding' && key !== 'engagement' && key !== 'anniversary') {
        assert.doesNotMatch(copy.uploadLabel, /cặp đôi|couple photo|情侣|カップル|커플 사진/i)
      }
    }
  }
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

test('calendar, reminder, thanks and gift drop wedding words outside a wedding', () => {
  const wedding = {
    calendarEventTitle: 'Tiệc cưới {groom} & {bride}',
    coverReminderOptIn: 'Nhắc lịch cưới (tùy chọn)',
    defaultThankYou: 'ngày cưới của chúng tôi',
  }
  assert.equal(applyInvitationOccasionPublicCopy(wedding, 'wedding', 'vi'), wedding)
  const surface = applyInvitationOccasionPublicCopy(wedding, 'birthday', 'vi')
  assert.equal(surface.calendarEventTitle, 'Sinh nhật {couple}')
  assert.match(surface.calendarEventDescription, /sinh nhật/)
  assert.doesNotMatch(surface.coverReminderOptIn, /cưới/)
  assert.doesNotMatch(surface.reminderTitle, /cưới|đám/)
  assert.doesNotMatch(surface.defaultThankYou, /cưới/)
  assert.doesNotMatch(surface.noWishes, /cưới/)
  assert.equal(
    applyInvitationCalendarCopy(
      { sectionTitle: 'THÔNG TIN TIỆC CƯỚI', introLine: 'TIỆC CƯỚI SẼ DIỄN RA VÀO LÚC:', countdownPast: 'Ngày cưới đã đến' },
      'birthday',
      'vi',
    ).sectionTitle,
    'THÔNG TIN SINH NHẬT',
  )
  assert.equal(applyInvitationGiftCopy({ boxTitle: 'Hộp Mừng Cưới' }, 'birthday', 'vi').boxTitle, 'Hộp mừng')
  assert.equal(
    applyInvitationGiftCopy({ boxTitle: 'Hộp Mừng Cưới', groomSection: 'Chú rể', brideSection: 'Cô dâu' }, 'anniversary', 'vi').groomSection,
    'Bên thứ nhất',
  )
  assert.equal(applyInvitationGiftCopy({ boxTitle: 'Hộp Mừng Cưới' }, 'wedding', 'vi').boxTitle, 'Hộp Mừng Cưới')
  for (const key of INVITATION_OCCASION_KEYS) {
    if (key === 'wedding') continue
    for (const locale of ['vi', 'en', 'zh', 'ja', 'ko']) {
      const copy = applyInvitationOccasionPublicCopy(wedding, key, locale)
      assert.ok(copy.calendarEventTitle.trim())
      assert.ok(copy.defaultThankYou.trim())
      assert.doesNotMatch(copy.calendarEventTitle, /Tiệc cưới|Wedding of|婚礼|結婚披露宴|결혼식/)
    }
  }
})

test('card structure is two houses, optional second party, or one person', () => {
  for (const key of ['wedding', 'engagement'] as const) {
    assert.deepEqual(invitationCardStructure(key), { nameLayout: 'pair', portraitLayout: 'pair', venueLayout: 'two' })
    assert.equal(invitationShowsSecondVenue(key, {}), true)
  }
  assert.deepEqual(invitationCardStructure('anniversary'), {
    nameLayout: 'pair',
    portraitLayout: 'pair',
    venueLayout: 'optional-second',
  })
  assert.equal(invitationShowsSecondVenue('anniversary', {}), false)
  assert.equal(invitationShowsSecondVenue('anniversary', { address: '  ' }), false)
  assert.equal(invitationShowsSecondVenue('anniversary', { address: 'Nhà hàng' }), true)
  assert.equal(invitationShowsSecondVenue('anniversary', { date: '2026-11-02' }), true)
  for (const key of INVITATION_OCCASION_KEYS) {
    if (key === 'wedding' || key === 'engagement' || key === 'anniversary') continue
    const structure = invitationCardStructure(key)
    assert.equal(structure.nameLayout, 'primary')
    assert.equal(structure.portraitLayout, 'primary')
    assert.equal(structure.venueLayout, 'one')
    assert.equal(invitationShowsSecondVenue(key, { address: 'Nhà trai', date: '2026-11-02' }), false)
  }
})
