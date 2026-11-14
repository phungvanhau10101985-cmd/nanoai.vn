import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { textCaretRect } from './text-caret'

describe('text caret', () => {
  it('stands upright at the insertion point and after the typed advance', () => {
    const empty = textCaretRect(40, 80, 32)
    assert.equal(empty.x, 40)
    assert.equal(empty.y, 80)
    assert.equal(empty.h, 32)
    assert.ok(empty.w < empty.h)
    assert.ok(empty.w <= 4)

    const typed = textCaretRect(40, 80, 32, 18.4)
    assert.equal(typed.x, 58)
    assert.equal(typed.y, 80)
    assert.equal(typed.w, empty.w)
    assert.equal(typed.h, empty.h)
  })
})