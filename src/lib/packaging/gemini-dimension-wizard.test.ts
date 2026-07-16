import assert from 'node:assert/strict'
import test from 'node:test'

import {
  allFacesGeminiExact,
  buildDimensionsFromDraft,
  exactGeminiFaceRatio,
  getHeightOptionsForLengthWidth,
  getWidthOptionsForLength,
  getWidthOptionsForLengthLxwOnly,
  parseSingleBoxDimension,
  pickHeightOption,
  pickWidthOption,
} from '@/lib/packaging/gemini-dimension-wizard'

test('parseSingleBoxDimension accepts cm and mm', () => {
  assert.deepEqual(parseSingleBoxDimension('50'), { ok: true, valueMm: 500 })
  assert.deepEqual(parseSingleBoxDimension('50 cm'), { ok: true, valueMm: 500 })
  assert.deepEqual(parseSingleBoxDimension('500 mm'), { ok: true, valueMm: 500 })
  assert.equal(parseSingleBoxDimension('abc').ok, false)
})

test('L×W-only width list is at least as large as strict 3-face list', () => {
  const lxwOnly = getWidthOptionsForLengthLxwOnly(500)
  const strict = getWidthOptionsForLength(500)
  assert.ok(lxwOnly.length >= strict.length)
  assert.ok(lxwOnly.length > 0)
})

test('50cm length yields Gemini-exact width and height options', () => {
  const widths = getWidthOptionsForLength(500)
  assert.ok(widths.length > 0)
  const w333 = widths.find((w) => Math.abs(w.widthMm - 333.33) < 0.1)
  assert.ok(w333)
  assert.equal(w333!.geminiLxw, '3:2')

  const heights = getHeightOptionsForLengthWidth(500, w333!.widthMm)
  assert.ok(heights.length > 0)
  for (const h of heights) {
    assert.equal(h.geminiLxw, '3:2')
    assert.ok(h.geminiLxh.length > 0)
    assert.ok(h.geminiWxh.length > 0)
  }
})

test('pickWidthOption by index and by cm value', () => {
  const picked = pickWidthOption('1', 500)
  assert.ok(picked)
  const byCm = pickWidthOption('33.3', 500)
  assert.ok(byCm)
  assert.equal(Math.round(byCm!.widthMm), 333)
})

test('full box from wizard has all faces Gemini exact', () => {
  const w = pickWidthOption('3', 500)!
  const h = pickHeightOption('1', 500, w.widthMm)!
  const box = buildDimensionsFromDraft(500, w.widthMm, h.heightMm)
  assert.equal(allFacesGeminiExact(box), true)
})

test('exactGeminiFaceRatio matches 50x30 to closest gemini when computed', () => {
  const ratio = exactGeminiFaceRatio(500, 281.25)
  assert.equal(ratio, '16:9')
})
