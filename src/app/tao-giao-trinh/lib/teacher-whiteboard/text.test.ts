import assert from 'node:assert/strict'
import test from 'node:test'
import { hitTestObject, sanitizeWhiteboardObject, translateObject } from './model'
import { textWorldBox, wrapTextLines } from './text'
import type { WhiteboardText } from './types'

test('chữ xuống dòng theo khung và giữ Enter', () => {
  const lines = wrapTextLines('abcdef\nXY', 28 * 0.55 * 3, 28)
  assert.ok(lines[0].length <= 3)
  assert.ok(lines.includes('XY'))
  assert.equal(wrapTextLines('Một dòng', 400, 28).length, 1)
})

test('chữ lưu được, chữ trống thì bỏ, kéo thì đổi chỗ', () => {
  const raw: WhiteboardText = {
    kind: 'text',
    id: 't1',
    color: '#111827',
    size: 28,
    text: 'Bài học\nHôm nay',
    x: 10,
    y: 20,
    width: 320,
  }
  const kept = sanitizeWhiteboardObject(raw)
  assert.equal(kept && kept.kind === 'text' ? kept.text : '', 'Bài học\nHôm nay')
  assert.equal(sanitizeWhiteboardObject({ ...raw, text: '   \n' }), null)
  const moved = translateObject(raw, 5, -3)
  assert.equal(moved.kind === 'text' ? moved.x : 0, 15)
  assert.equal(moved.kind === 'text' ? moved.y : 0, 17)
  const box = textWorldBox(raw)
  assert.ok(box.maxY > raw.y + 28)
  const short = textWorldBox({ text: '2+3=5', x: 0, y: 0, width: 320, size: 28 })
  assert.ok(short.maxX - short.minX < 140)
  assert.ok(short.maxX - short.minX > 40)
  assert.equal(hitTestObject(raw, { x: 12, y: 22 }, 4), true)
  assert.equal(hitTestObject(raw, { x: 900, y: 900 }, 4), false)
})
