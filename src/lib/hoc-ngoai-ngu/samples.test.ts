import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { LANGUAGE_PAIR_CODES, SAMPLE_GLOSS, SPEAKING_SAMPLES } from './samples'
import { CHINESE_COACH_SEED_REVIEWS, JAPANESE_COACH_SEED_REVIEWS, KOREAN_COACH_SEED_REVIEWS, LANGUAGE_COACH_SEED_REVIEWS, VIETNAMESE_COACH_SEED_REVIEWS } from './reviews'
import { readLessonLanguageQuery } from './lesson-query'
import { chineseLandingCopy } from './chinese-landing-copy'
import { japaneseLandingCopy } from './japanese-landing-copy'
import { koreanLandingCopy } from './korean-landing-copy'
import { vietnameseLandingCopy } from './vietnamese-landing-copy'

describe('language landing samples', () => {
  it('has a speaking turn and a native gloss for every pair', () => {
    for (const target of LANGUAGE_PAIR_CODES) {
      const sample = SPEAKING_SAMPLES[target]
      assert.ok(sample.teacher && sample.learner && sample.fix)
      assert.notEqual(sample.learner, sample.fix)
      for (const native of LANGUAGE_PAIR_CODES) {
        assert.ok(SAMPLE_GLOSS[target][native])
      }
    }
  })

  it('keeps seed reviews free of vendor model names', () => {
    const blob = [...LANGUAGE_COACH_SEED_REVIEWS, ...VIETNAMESE_COACH_SEED_REVIEWS, ...CHINESE_COACH_SEED_REVIEWS, ...JAPANESE_COACH_SEED_REVIEWS, ...KOREAN_COACH_SEED_REVIEWS].map((review) => review.body).join('\n')
    assert.equal(/GPT|Gemini|OpenAI/i.test(blob), false)
    assert.ok(LANGUAGE_COACH_SEED_REVIEWS.length >= 8)
    assert.ok(VIETNAMESE_COACH_SEED_REVIEWS.length >= 8)
    assert.ok(CHINESE_COACH_SEED_REVIEWS.length >= 8)
    assert.ok(JAPANESE_COACH_SEED_REVIEWS.length >= 8)
    assert.ok(KOREAN_COACH_SEED_REVIEWS.length >= 8)
  })

  it('opens the Japanese room with Japanese locked and Vietnamese as the native language', () => {
    assert.deepEqual(readLessonLanguageQuery({ get: (name) => (name === 'hoc' ? 'ja' : name === 'me' ? 'vi' : null) }), {
      target: 'ja',
      native: 'vi',
    })
    const copy = japaneseLandingCopy('vi', '3,5 credit · 21.000đ', '2 credit · 12.000đ')
    assert.match(copy.h1, /tiếng Nhật/i)
    assert.match(copy.modes[0]?.href ?? '', /hoc=ja/)
    assert.match(copy.modes[1]?.href ?? '', /me=vi/)
    assert.equal(copy.modes[2]?.href, '/hoc-tieng-anh-ai/tu-moi')
  })

  it('opens the Korean room with Korean locked and Vietnamese as the native language', () => {
    assert.deepEqual(readLessonLanguageQuery({ get: (name) => (name === 'hoc' ? 'ko' : name === 'me' ? 'vi' : null) }), {
      target: 'ko',
      native: 'vi',
    })
    const copy = koreanLandingCopy('vi', '3,5 credit · 21.000đ', '2 credit · 12.000đ')
    assert.match(copy.h1, /tiếng Hàn/i)
    assert.match(copy.modes[0]?.href ?? '', /hoc=ko/)
    assert.match(copy.modes[1]?.href ?? '', /me=vi/)
    assert.equal(copy.modes[2]?.href, '/hoc-tieng-anh-ai/tu-moi')
  })

  it('opens the Chinese room with Chinese locked and Vietnamese as the native language', () => {
    assert.deepEqual(readLessonLanguageQuery({ get: (name) => (name === 'hoc' ? 'zh' : name === 'me' ? 'vi' : null) }), {
      target: 'zh',
      native: 'vi',
    })
    const copy = chineseLandingCopy('vi', '3,5 credit · 21.000đ', '2 credit · 12.000đ')
    assert.match(copy.h1, /tiếng Trung/i)
    assert.match(copy.modes[0]?.href ?? '', /hoc=zh/)
    assert.match(copy.modes[1]?.href ?? '', /me=vi/)
    assert.equal(copy.modes[2]?.href, '/hoc-tieng-anh-ai/tu-moi')
  })

  it('opens the Vietnamese room with Vietnamese locked and a foreign native language', () => {
    assert.deepEqual(readLessonLanguageQuery({ get: (name) => (name === 'hoc' ? 'vi' : name === 'me' ? 'en' : null) }), {
      target: 'vi',
      native: 'en',
    })
    assert.equal(readLessonLanguageQuery({ get: () => 'vi' }).native, null)
    const copy = vietnameseLandingCopy('vi', '3,5 credit · 21.000đ', '2 credit · 12.000đ')
    assert.match(copy.h1, /tiếng Việt/i)
    assert.match(copy.modes[0]?.href ?? '', /hoc=vi/)
    assert.match(copy.modes[1]?.href ?? '', /hoc=vi/)
    assert.equal(copy.modes[2]?.href, '/hoc-tieng-anh-ai/tu-moi')
  })
})
