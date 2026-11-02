import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WEDDING_SAMPLE_COMPOSE_CREDIT,
  appendWeddingComposeSuggestion,
  applyComposeCopyToCard,
  weddingCardAfterCreate,
  buildWeddingSampleComposePrompt,
  carryWeddingSampleFacts,
  parseWeddingSampleComposeCopy,
  newCardComposeSources,
  resolveWeddingSampleNameReuse,
  weddingSampleShowsLoveStoryHints,
  type WeddingSampleFactCard,
} from './wedding-sample-compose'

test('wedding samples show the meeting-day hints', () => {
  assert.equal(weddingSampleShowsLoveStoryHints({}), true)
  assert.equal(weddingSampleShowsLoveStoryHints({ occasionKey: 'wedding' }), true)
  assert.equal(weddingSampleShowsLoveStoryHints({ occasionKey: 'birthday' }), false)
  assert.equal(WEDDING_SAMPLE_COMPOSE_CREDIT, 0)
})

test('a suggestion line is inserted once', () => {
  const once = appendWeddingComposeSuggestion('', 'Ngày gặp nhau: ')
  assert.equal(once, 'Ngày gặp nhau: ')
  assert.equal(appendWeddingComposeSuggestion(once, 'Ngày gặp nhau: '), once)
  assert.equal(appendWeddingComposeSuggestion('Đã yêu nhau.', 'Nơi gặp nhau: '), 'Đã yêu nhau.\nNơi gặp nhau: ')
})

test('parser reads fenced JSON and drops an empty quote', () => {
  const copy = parseWeddingSampleComposeCopy(
    '```json\n{"coupleIntro":"Mở.","loveQuote":"Một câu ngắn.","storyText":"Chuyện.","thankYouText":"Cảm ơn."}\n```',
  )
  assert.equal(copy?.loveQuote, 'Một câu ngắn.')
  assert.equal(parseWeddingSampleComposeCopy('{"coupleIntro":"Mở.","loveQuote":"","storyText":"Chuyện.","thankYouText":"Cảm ơn."}'), null)
})

test('empty notes forbid invented meetings and named notes are kept', () => {
  const blank = buildWeddingSampleComposePrompt({
    groomName: 'Minh',
    brideName: 'Lan',
    storyNotes: '',
    occasionKey: 'wedding',
  })
  assert.match(blank, /Minh và Lan/)
  assert.match(blank, /Cấm bịa ngày/)
  const noted = buildWeddingSampleComposePrompt({
    groomName: 'Minh',
    brideName: 'Lan',
    storyNotes: 'Ngày gặp nhau: 2018',
    occasionKey: 'wedding',
  })
  assert.match(noted, /Ngày gặp nhau: 2018/)
  assert.match(noted, /Chỉ dùng sự kiện khách đã ghi/)
  assert.doesNotMatch(noted, /Địa điểm:/)
})

test('compose copy fills prose and keeps an existing dress code', () => {
  const next = applyComposeCopyToCard(
    {
      groomName: '',
      brideName: '',
      coupleIntro: '',
      loveQuote: '',
      storyText: '',
      thankYouText: '',
      dressCode: 'Tông kem.',
    },
    {
      groomName: 'Minh',
      brideName: 'Lan',
      coupleIntro: 'Mở.',
      loveQuote: 'Một câu.',
      storyText: 'Chuyện.',
      thankYouText: 'Cảm ơn.',
    },
    'Tông đỏ.',
  )
  assert.equal(next.groomName, 'Minh')
  assert.equal(next.storyText, 'Chuyện.')
  assert.equal(next.dressCode, 'Tông kem.')
})

test('compose copy stays on the card just created, not the card still open', () => {
  const created = {
    id: 'new-engagement',
    groomName: '',
    brideName: '',
    coupleIntro: '',
    loveQuote: '',
    storyText: '',
    thankYouText: '',
    dressCode: '',
    weddingDate: '',
  }
  const next = weddingCardAfterCreate(
    created,
    {
      groomName: 'Hậu',
      brideName: 'Lan',
      coupleIntro: 'Lễ hỏi.',
      loveQuote: 'Hai nhà.',
      storyText: 'Đám hỏi.',
      thankYouText: 'Cảm ơn.',
    },
    '2026-12-01',
  )
  assert.equal(next.id, 'new-engagement')
  assert.equal(next.groomName, 'Hậu')
  assert.equal(next.brideName, 'Lan')
  assert.equal(next.coupleIntro, 'Lễ hỏi.')
  assert.equal(next.storyText, 'Đám hỏi.')
  assert.equal(next.weddingDate, '2026-12-01')
  const birthday = weddingCardAfterCreate(
    { ...created, id: 'new-birthday', occasionKey: 'wedding' },
    {
      groomName: 'Bé An',
      brideName: '',
      coupleIntro: 'Mời đầy tháng.',
      loveQuote: 'Chúc bé.',
      storyText: 'Gia đình.',
      thankYouText: 'Cảm ơn.',
    },
    null,
    'full_month',
  )
  assert.equal(birthday.id, 'new-birthday')
  assert.equal(birthday.occasionKey, 'full_month')
  assert.equal(birthday.groomName, 'Bé An')
  assert.equal(birthday.coupleIntro, 'Mời đầy tháng.')
  const plain = weddingCardAfterCreate(created, null, null)
  assert.equal(plain.id, 'new-engagement')
  assert.equal(plain.coupleIntro, '')
})

function blankFacts(patch: Partial<WeddingSampleFactCard> = {}): WeddingSampleFactCard {
  return {
    groomName: '',
    brideName: '',
    weddingTime: '',
    partyStartTime: '',
    venue: '',
    mapUrl: '',
    invitationText: '',
    invitationTextEn: '',
    storyText: '',
    coupleIntro: '',
    loveQuote: '',
    eventTimeline: '',
    dressCode: '',
    thankYouText: '',
    groomParents: '',
    brideParents: '',
    groomHometown: '',
    brideHometown: '',
    groomInviteAddress: '',
    groomInviteMapUrl: '',
    groomInviteReceptionTime: '',
    groomInvitePartyStartTime: '',
    groomInviteText: '',
    groomInviteTextEn: '',
    groomInviteEventTimeline: '',
    groomInviteDressCode: '',
    groomInviteContact: '',
    groomInviteDefaultPersonalMessage: '',
    groomInviteThankYouText: '',
    brideInviteAddress: '',
    brideInviteMapUrl: '',
    brideInviteReceptionTime: '',
    brideInvitePartyStartTime: '',
    brideInviteText: '',
    brideInviteTextEn: '',
    brideInviteEventTimeline: '',
    brideInviteDressCode: '',
    brideInviteContact: '',
    brideInviteDefaultPersonalMessage: '',
    brideInviteThankYouText: '',
    musicUrl: '',
    giftQrImageUrl: '',
    groomGiftBankId: '',
    groomGiftAccountNo: '',
    groomGiftAccountName: '',
    brideGiftBankId: '',
    brideGiftAccountNo: '',
    brideGiftAccountName: '',
    groomImageUrl: '',
    brideImageUrl: '',
    groomInviteCoverImageUrl: '',
    brideInviteCoverImageUrl: '',
    weddingDate: null,
    groomInviteWeddingDate: null,
    brideInviteWeddingDate: null,
    albumImageUrls: [],
    musicPlayStartSec: null,
    musicPlayEndSec: null,
    giftQrEnabled: false,
    sectionConfig: '{}',
    ...patch,
  }
}

test('the name modal follows the occasion, not only weddings', () => {
  assert.deepEqual(
    resolveWeddingSampleNameReuse({
      current: { id: 'draft', groomName: '', brideName: '' },
      saved: [{ id: 'draft', groomName: '', brideName: '' }],
      occasionKey: 'wedding',
    }),
    { ask: true },
  )
  assert.deepEqual(
    resolveWeddingSampleNameReuse({
      current: { id: 'card', groomName: 'Minh', brideName: 'Lan' },
      saved: [{ id: 'card', groomName: 'Minh', brideName: 'Lan' }],
      occasionKey: 'anniversary',
    }),
    { ask: false, donorId: null },
  )
  assert.deepEqual(
    resolveWeddingSampleNameReuse({
      current: { id: 'draft', groomName: '', brideName: '' },
      saved: [
        { id: 'draft', groomName: '', brideName: '' },
        { id: 'older', groomName: 'Minh', brideName: 'Lan' },
      ],
      occasionKey: 'engagement',
    }),
    { ask: false, donorId: 'older' },
  )
  assert.deepEqual(
    resolveWeddingSampleNameReuse({
      current: { id: 'draft', groomName: 'Minh', brideName: '' },
      saved: [{ id: 'older', groomName: 'Minh', brideName: '' }],
      occasionKey: 'engagement',
    }),
    { ask: true },
  )
  assert.deepEqual(
    resolveWeddingSampleNameReuse({
      current: { id: 'draft', groomName: 'An', brideName: '' },
      saved: [],
      occasionKey: 'birthday',
    }),
    { ask: false, donorId: null },
  )
  assert.deepEqual(
    resolveWeddingSampleNameReuse({
      current: { id: 'draft', groomName: '', brideName: 'A' },
      saved: [{ id: 'older', groomName: 'Tiệm Hoa', brideName: '' }],
      occasionKey: 'grand_opening',
    }),
    { ask: false, donorId: 'older' },
  )
})

test('a new card does not borrow the open card date or address', () => {
  assert.deepEqual(
    newCardComposeSources({
      creating: true,
      composeDate: '',
      openDate: '2026-12-20',
      openAddresses: ['Số 12 phố Huế, Hai Bà Trưng, Hà Nội'],
    }),
    { weddingDate: '', addresses: [] },
  )
  assert.deepEqual(
    newCardComposeSources({
      creating: true,
      composeDate: '2026-11-20',
      openDate: '2026-12-20',
      openAddresses: ['Số 12 phố Huế'],
    }),
    { weddingDate: '2026-11-20', addresses: [] },
  )
  assert.deepEqual(
    newCardComposeSources({
      creating: false,
      composeDate: '',
      openDate: '2026-12-20',
      openAddresses: ['Số 12 phố Huế'],
    }),
    { weddingDate: '2026-12-20', addresses: ['Số 12 phố Huế'] },
  )
})

test('an existing invitation fills the new template without replacing its look or its own text', () => {
  const visual = {
    ...blankFacts({ coupleIntro: 'Lời đang viết.', sectionConfig: '{"backgroundPresetId":"sen-vang"}' }),
    selectedStyleId: 'rose',
  }
  const donor = blankFacts({
    groomName: 'Minh',
    brideName: 'Lan',
    coupleIntro: 'Lời cũ.',
    venue: 'Nhà hàng Sen',
    weddingDate: '2026-11-20',
    groomImageUrl: '/wedding/samples/groom.jpg',
    brideImageUrl: 'https://cdn.example/bride.jpg',
    albumImageUrls: ['/wedding/samples/album.jpg', 'https://cdn.example/album.jpg'],
    groomGiftAccountNo: '123',
    giftQrEnabled: true,
    sectionConfig: '{"coverPhotoUrl":"https://cdn.example/cover.jpg","backgroundPresetId":"toi-gian-nau"}',
  })
  const next = carryWeddingSampleFacts(visual, donor)
  assert.equal(next.selectedStyleId, 'rose')
  assert.equal(next.groomName, 'Minh')
  assert.equal(next.brideName, 'Lan')
  assert.equal(next.coupleIntro, 'Lời đang viết.')
  assert.equal(next.venue, 'Nhà hàng Sen')
  assert.equal(next.weddingDate, '2026-11-20')
  assert.equal(next.groomImageUrl, '')
  assert.equal(next.brideImageUrl, 'https://cdn.example/bride.jpg')
  assert.deepEqual(next.albumImageUrls, ['https://cdn.example/album.jpg'])
  assert.equal(next.giftQrEnabled, true)
  assert.match(next.sectionConfig, /sen-vang/)
  assert.match(next.sectionConfig, /cdn\.example\/cover\.jpg/)
  assert.doesNotMatch(next.sectionConfig, /toi-gian-nau/)
})
