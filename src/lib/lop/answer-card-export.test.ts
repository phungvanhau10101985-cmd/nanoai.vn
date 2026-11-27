import assert from 'node:assert/strict'
import test from 'node:test'
import { classJoinGlyphLimit, classJoinQrBox, classJoinTextOrigin } from './answer-card-export'

const card = { cardX: 8, cardW: 194, hintBottom: 220, contentBottom: 285 }

test('class QR sits in the left gap and stays clear of the name block', () => {
  const glyphWidth = 57
  const box = classJoinQrBox({ ...card, glyphWidth })
  assert.ok(box)
  const glyphLeft = card.cardX + card.cardW / 2 - glyphWidth / 2
  assert.ok(box.x >= card.cardX)
  assert.ok(box.y > card.hintBottom)
  assert.ok(box.x + box.size + 3 <= glyphLeft + 0.01)
  assert.ok(box.y + box.size <= card.contentBottom + 0.01)
  assert.ok(box.size >= 32)
})

test('a short name still keeps the QR inside the card', () => {
  const box = classJoinQrBox({ ...card, glyphWidth: 30 })
  assert.ok(box)
  assert.equal(box.size, card.contentBottom - card.hintBottom - 2)
  assert.ok(box.x + box.size < card.cardX + card.cardW / 2 - 15)
})

test('text that fills the card does not get a QR on top of the letters', () => {
  assert.equal(classJoinQrBox({ ...card, glyphWidth: 180 }), null)
})

test('name block sits centered beside the class QR', () => {
  const box = classJoinQrBox({ ...card, glyphWidth: 57 })
  assert.ok(box)
  const blockHeight = 27
  const text = classJoinTextOrigin({ ...card, join: box, blockHeight })
  assert.ok(text)
  assert.ok(text.x >= box.x + box.size)
  const columnRight = card.cardX + card.cardW - 6
  const columnMid = (text.x + columnRight) / 2
  assert.ok(Math.abs(text.x + text.width / 2 - columnMid) < 0.01)
  const textMid = text.y + blockHeight / 2
  const qrMid = box.y + box.size / 2
  assert.ok(Math.abs(textMid - qrMid) < 0.01)
})

test('glyph limit leaves a scannable QR when the name is long', () => {
  const roomH = card.contentBottom - card.hintBottom
  const limit = classJoinGlyphLimit(card.cardW, roomH, 32)
  assert.ok(limit)
  assert.ok(limit < 180)
  const box = classJoinQrBox({ ...card, glyphWidth: limit })
  assert.ok(box)
  assert.ok(box.size >= 32 - 2)
})
