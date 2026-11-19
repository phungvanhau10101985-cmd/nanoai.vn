import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dialogClearOfFigure } from './ask-place'

test('hộp hỏi né hình vừa vẽ', () => {
  const board = { w: 1000, h: 700 }
  const card = { w: 384, h: 320 }
  const top = dialogClearOfFigure(board, { minX: 360, minY: 30, maxX: 640, maxY: 180 }, card)
  assert.ok(top.top > 200)
  const bottom = dialogClearOfFigure(board, { minX: 360, minY: 480, maxX: 640, maxY: 660 }, card)
  assert.ok(bottom.top < 80)
  const left = dialogClearOfFigure(board, { minX: 20, minY: 200, maxX: 220, maxY: 460 }, card)
  assert.ok(left.left > 500)
})
