import assert from 'node:assert/strict'
import test from 'node:test'

import { getDictionary } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'

import {
  isFacePolishSkipDraft,
  isPackagingFacePolishStep,
  missingQuotedPrintSpans,
  quotedPrintSpans,
} from '@/lib/packaging/face-prompt-polish-credit'
import {
  buildPackagingFacePolishUserPrompt,
  PACKAGING_FACE_POLISH_SYSTEM,
} from '@/lib/packaging/face-prompt-polish'

test('face polish is only on box and bag print faces', () => {
  assert.equal(isPackagingFacePolishStep('packaging_kit', 'face_front'), true)
  assert.equal(isPackagingFacePolishStep('packaging_kit', 'body_strip'), true)
  assert.equal(isPackagingFacePolishStep('packaging_kit', 'logo'), false)
  assert.equal(isPackagingFacePolishStep('bag_kit', 'face_back'), true)
  assert.equal(isPackagingFacePolishStep('bag_kit', 'face_top'), false)
  assert.equal(isPackagingFacePolishStep('sale_banner', 'face_front'), false)
})

test('skip-only drafts are not rewritten into a design brief', () => {
  assert.equal(isFacePolishSkipDraft('bỏ trống'), true)
  assert.equal(isFacePolishSkipDraft('same as front'), true)
  assert.equal(isFacePolishSkipDraft('Mặt trước, tên "Sữa tươi 180ml"'), false)
})

test('quoted print copy must survive the rewrite', () => {
  const draft = 'Hero giữa mặt. In đúng "Sữa tươi 180ml" và «Tươi mỗi ngày».'
  assert.deepEqual(quotedPrintSpans(draft), ['Sữa tươi 180ml', 'Tươi mỗi ngày'])
  assert.deepEqual(
    missingQuotedPrintSpans(draft, 'Giữa mặt in "Sữa tươi 180ml".'),
    ['Tươi mỗi ngày']
  )
  assert.deepEqual(missingQuotedPrintSpans(draft, 'Giữa mặt in "Sữa tươi 180ml" và «Tươi mỗi ngày».'), [])
})

test('face polish copy exists in every web locale', () => {
  const locales: WebLocale[] = ['vi', 'en', 'zh', 'ja', 'ko']
  for (const locale of locales) {
    const copy = getDictionary(locale).hubChat
    assert.ok(copy.studioFacePolishAi.trim().length > 0, locale)
    assert.ok(copy.studioFacePolishHint.trim().length > 0, locale)
    assert.ok(copy.studioFacePolishDone.trim().length > 0, locale)
    assert.ok(copy.studioFacePolishNeedCredit.includes('0'), locale)
    assert.ok(copy.studioFacePolishSkip.trim().length > 0, locale)
  }
})

test('polish prompt keeps print copy and leaves print size to code', () => {
  assert.match(PACKAGING_FACE_POLISH_SYSTEM, /character-for-character/i)
  assert.match(PACKAGING_FACE_POLISH_SYSTEM, /Never translate/i)
  assert.match(PACKAGING_FACE_POLISH_SYSTEM, /millimeters/i)
  assert.doesNotMatch(PACKAGING_FACE_POLISH_SYSTEM, /\d+\s*mm/)
  const user = buildPackagingFacePolishUserPrompt({
    faceLabel: 'Mặt trước',
    draft: 'Logo trên, tên "Cam ép" dưới.',
    locale: 'vi',
  })
  assert.match(user, /Mặt trước/)
  assert.match(user, /Cam ép/)
  assert.doesNotMatch(user, /\d+\s*mm/)
})
