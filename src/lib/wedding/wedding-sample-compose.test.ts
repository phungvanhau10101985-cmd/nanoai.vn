import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WEDDING_SAMPLE_COMPOSE_CREDIT,
  appendWeddingComposeSuggestion,
  applyComposeCopyToCard,
  buildWeddingSampleComposePrompt,
  parseWeddingSampleComposeCopy,
  weddingSampleShowsLoveStoryHints,
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
  assert.match(blank, /Cấm bịa ngày gặp/)
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
