import assert from 'node:assert/strict'
import test from 'node:test'
import {
  answerCardDownloadBase,
  answerCardPayload,
  answerCardGivenName,
  answerCardShortName,
  cameraHoldFromScreenAngle,
  cameraHoldFromWindowOrientation,
  choiceFromQrTopEdge,
  parseAnswerCardPayload,
  raisedCardQuestionIndex,
  scanQuestionFromParts,
  summarizeAnswerPicks,
} from './answer-card'

test('upright card is A, clockwise quarters are B C D', () => {
  assert.equal(choiceFromQrTopEdge({ x: 0, y: 0 }, { x: 10, y: 0 }, 'portrait'), 'A')
  assert.equal(choiceFromQrTopEdge({ x: 0, y: 0 }, { x: 0, y: 10 }, 'portrait'), 'B')
  assert.equal(choiceFromQrTopEdge({ x: 10, y: 0 }, { x: 0, y: 0 }, 'portrait'), 'C')
  assert.equal(choiceFromQrTopEdge({ x: 0, y: 10 }, { x: 0, y: 0 }, 'portrait'), 'D')
})

test('phone rotation picks the camera side', () => {
  assert.equal(cameraHoldFromScreenAngle(0), 'portrait')
  assert.equal(cameraHoldFromScreenAngle(180), 'portrait')
  assert.equal(cameraHoldFromScreenAngle(90), 'landscape-right')
  assert.equal(cameraHoldFromScreenAngle(270), 'landscape-left')
  assert.equal(cameraHoldFromScreenAngle(-90), 'landscape-left')
  assert.equal(cameraHoldFromWindowOrientation(0), 'portrait')
  assert.equal(cameraHoldFromWindowOrientation(90), 'landscape-left')
  assert.equal(cameraHoldFromWindowOrientation(-90), 'landscape-right')
})

test('landscape hold keeps a ceiling-up A card as A', () => {
  assert.equal(choiceFromQrTopEdge({ x: 0, y: 0 }, { x: 0, y: 10 }, 'landscape-left'), 'A')
  assert.equal(choiceFromQrTopEdge({ x: 0, y: 10 }, { x: 0, y: 0 }, 'landscape-right'), 'A')
})

test('card payload is the two-digit seat and ignores other QR text', () => {
  assert.equal(answerCardPayload(8), '08')
  assert.equal(parseAnswerCardPayload(answerCardPayload(8) ?? ''), '08')
  assert.equal(answerCardPayload(99), '99')
  assert.equal(answerCardPayload(0), null)
  assert.equal(answerCardPayload(100), null)
  assert.equal(parseAnswerCardPayload('8'), null)
  assert.equal(parseAnswerCardPayload('00'), null)
  assert.equal(parseAnswerCardPayload('12345678'), null)
  assert.equal(parseAnswerCardPayload('https://example.com'), null)
  assert.equal(parseAnswerCardPayload('NAC1.short'), null)
})

test('only 2 to 4 choices become a scannable question', () => {
  const ok = scanQuestionFromParts('Câu hỏi?', ['một', 'hai', 'ba'], 1)
  assert.deepEqual(ok, { prompt: 'Câu hỏi?', choices: ['một', 'hai', 'ba'], correct: 'B' })
  assert.equal(scanQuestionFromParts('Câu?', ['a', 'b', 'c', 'd', 'e'], 0), null)
  assert.equal(scanQuestionFromParts('Câu?', ['a'], 0), null)
  assert.equal(scanQuestionFromParts('   ', ['a', 'b'], 0), null)
})

test('raised card index skips questions that are not A–D', () => {
  const flags = [true, false, true, true]
  assert.equal(raisedCardQuestionIndex(flags, 0), 0)
  assert.equal(raisedCardQuestionIndex(flags, 1), null)
  assert.equal(raisedCardQuestionIndex(flags, 2), 1)
  assert.equal(raisedCardQuestionIndex(flags, 3), 2)
  assert.equal(raisedCardQuestionIndex(flags, 4), null)
})

test('download name keeps letters and drops punctuation', () => {
  assert.equal(answerCardDownloadBase('12A1 / Sinh'), 'the-tra-loi-12A1-Sinh')
  assert.equal(answerCardDownloadBase('   '), 'the-tra-loi-lop')
})

test('short name keeps the last two words', () => {
  assert.equal(answerCardShortName('Phạm Diệu Linh'), 'Diệu Linh')
  assert.equal(answerCardShortName('An'), 'An')
})

test('scan label uses the given name', () => {
  assert.equal(answerCardGivenName('Nguyễn Thị Quỳnh'), 'Quỳnh')
  assert.equal(answerCardGivenName('Phùng Văn Hậu'), 'Hậu')
  assert.equal(answerCardGivenName('An'), 'An')
  assert.equal(answerCardGivenName(''), '')
})

test('summary counts the latest pick per student', () => {
  const summary = summarizeAnswerPicks(
    ['1', '2', '3'],
    [
      { userId: '1', choice: 'A' },
      { userId: '1', choice: 'B' },
      { userId: '2', choice: 'C' },
    ],
    'A'
  )
  assert.equal(summary.correct, 0)
  assert.equal(summary.wrong, 2)
  assert.equal(summary.unanswered, 1)
  assert.equal(summary.byChoice.B, 1)
  assert.equal(summary.byChoice.C, 1)
})
