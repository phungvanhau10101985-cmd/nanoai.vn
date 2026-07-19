import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyDefaultPrintLanguageToBriefNotes,
  buildPackagingPrintLanguagePromptBlock,
  defaultPrintLanguageFields,
  resolvePrintLanguageKey,
} from '@/lib/packaging/packaging-print-language'

test('defaultPrintLanguageFields maps ui locale', () => {
  assert.deepEqual(defaultPrintLanguageFields('vi'), { print_language: 'vi' })
  assert.deepEqual(defaultPrintLanguageFields('en'), { print_language: 'en' })
  assert.deepEqual(defaultPrintLanguageFields('zh'), {
    print_language: 'other',
    print_language_detail: 'Chinese (Simplified)',
  })
})

test('applyDefaultPrintLanguageToBriefNotes preserves existing choice', () => {
  const next = applyDefaultPrintLanguageToBriefNotes({ print_language: 'en' }, 'vi')
  assert.equal(next.print_language, 'en')
})

test('buildPackagingPrintLanguagePromptBlock includes bilingual rule', () => {
  const block = buildPackagingPrintLanguagePromptBlock({ print_language: 'bilingual' })
  assert.match(block, /bilingual Vietnamese \+ English/i)
})

test('resolvePrintLanguageKey falls back to vi', () => {
  assert.equal(resolvePrintLanguageKey({}), 'vi')
  assert.equal(resolvePrintLanguageKey({ print_language: 'unknown' }), 'vi')
})
