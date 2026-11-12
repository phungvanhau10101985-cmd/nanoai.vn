import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filterListeningOptions,
  isLessonContentToken,
  prepareListeningWords,
  stripReadingLabels,
} from './listening-words'

const moviePrompt = [
  '你说得很好！你平时喜欢看哪种电影呢？',
  'Pinyin: Nǐ shuō de hěn hǎo! Nǐ píngshí xǐhuān kàn nǎ zhǒng diànyǐng ne?',
].join('\n')

test('reading label line is removed from the lesson sentence', () => {
  const cleaned = stripReadingLabels('こんにちは。\nRomaji: konnichiwa\nPhiên âm: xin chào')
  assert.equal(cleaned, 'こんにちは。')
  assert.equal(stripReadingLabels('Hello.\nRomanization: heh-loh'), 'Hello.')
})

test('stored listening keywords drop the Pinyin label and the reading syllables', () => {
  const prepared = prepareListeningWords(
    [
      '你说得很好',
      '你平时喜欢看哪种电影呢',
      'pinyin',
      'nǐ',
      'shuō',
      'de',
      'hěn',
      'hǎo',
      'píngshí',
      'xǐhuān',
      'kàn',
      'nǎ',
      'zhǒng',
      'diànyǐng',
      'ne',
    ],
    moviePrompt,
    'zh',
  )
  assert.equal(prepared.prompt.includes('Pinyin'), false)
  assert.ok(prepared.words.length >= 3)
  for (const word of prepared.words) {
    assert.equal(/[A-Za-z]/.test(word), false, word)
    assert.equal(word.toLowerCase() === 'pinyin', false)
    assert.equal(prepared.prompt.includes(word), true, word)
  }
})

test('a Chinese sentence is not tokenized as English when the page language has not switched yet', () => {
  const prepared = prepareListeningWords(
    ['你说得很好', 'pinyin', 'nǐ', 'shuō'],
    moviePrompt,
    'en',
  )
  assert.ok(prepared.words.length >= 3)
  for (const word of prepared.words) {
    assert.equal(/[A-Za-z]/.test(word), false, word)
  }
})

test('an English lesson keeps its words and drops a stray reading label', () => {
  const prepared = prepareListeningWords(
    ['hello', 'pinyin', 'friend', 'today'],
    'Hello friend today.\nPinyin: Nǐ hǎo',
    'en',
  )
  assert.deepEqual(prepared.words, ['hello', 'friend', 'today'])
  assert.equal(prepared.prompt.includes('Pinyin'), false)
})

test('listening options cannot be a reading label', () => {
  assert.equal(isLessonContentToken('pinyin', 'zh', true), false)
  assert.equal(isLessonContentToken('今天', 'zh', true), true)
  assert.deepEqual(
    filterListeningOptions(['现在', 'Pinyin', 'nǐ', '谢谢'], moviePrompt, 'zh'),
    ['现在', '谢谢'],
  )
})
