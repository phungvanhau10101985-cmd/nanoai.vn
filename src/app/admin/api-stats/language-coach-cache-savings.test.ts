import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { languageCoachCacheStatDayIct } from '../../../lib/db/language-coach-cache-day'
import {
  buildLanguageCoachCacheReport,
  estimateLanguageCoachCacheBucket,
  isLanguageCoachTtsFeature,
  isLanguageCoachWordLookupFeature,
} from './language-coach-cache-savings'

describe('language coach cache savings', () => {
  it('prices a hit as one real API call in the same range', () => {
    const row = estimateLanguageCoachCacheBucket({
      id: 'tts',
      hits: 80,
      misses: 20,
      spentVnd: 100_000,
      loggedCalls: 20,
    })
    assert.equal(row.hitRate, 0.8)
    assert.equal(row.savedVnd, 400_000)
    assert.equal(row.wouldHaveSpentVnd, 500_000)
  })

  it('does not invent a price when the range has hits but no API log', () => {
    const row = estimateLanguageCoachCacheBucket({
      id: 'word',
      hits: 12,
      misses: 0,
      spentVnd: 0,
      loggedCalls: 0,
    })
    assert.equal(row.hitRate, 1)
    assert.equal(row.savedVnd, 0)
    assert.equal(row.wouldHaveSpentVnd, 0)
  })

  it('leaves the rate empty when nothing was looked up', () => {
    const row = estimateLanguageCoachCacheBucket({
      id: 'tts',
      hits: 0,
      misses: 0,
      spentVnd: 0,
      loggedCalls: 0,
    })
    assert.equal(row.hitRate, null)
    assert.equal(row.lookups, 0)
  })

  it('counts TTS and word lookups, and ignores other coach features', () => {
    assert.equal(isLanguageCoachTtsFeature('english-coach-tts-openai'), true)
    assert.equal(isLanguageCoachTtsFeature('english-coach-tts-gemini'), true)
    assert.equal(isLanguageCoachTtsFeature('english-coach-live-tts-openai'), true)
    assert.equal(isLanguageCoachTtsFeature('english-coach-chat-main'), false)

    assert.equal(isLanguageCoachWordLookupFeature('english-coach-word'), true)
    assert.equal(isLanguageCoachWordLookupFeature('english-coach-live-word'), true)
    assert.equal(isLanguageCoachWordLookupFeature('english-coach-preset-word'), true)
    assert.equal(isLanguageCoachWordLookupFeature('english-coach-fix-word-examples'), false)
    assert.equal(isLanguageCoachWordLookupFeature('english-coach-live-fix-word-examples'), false)
  })

  it('splits savings by cache and sums them', () => {
    const report = buildLanguageCoachCacheReport(
      { ttsHit: 3, ttsMiss: 1, wordHit: 1, wordMiss: 1 },
      [
        {
          model: 'gpt-4o-mini-tts',
          feature: 'english-coach-tts-openai',
          prompt_token_count: 1_000_000,
          candidates_token_count: 0,
          image_size: null,
        },
        {
          model: 'gemini-2.5-flash',
          feature: 'english-coach-word',
          prompt_token_count: 1_000_000,
          candidates_token_count: 0,
          image_size: null,
        },
        {
          model: 'gemini-2.5-flash',
          feature: 'english-coach-chat-main',
          prompt_token_count: 1_000_000,
          candidates_token_count: 1_000_000,
          image_size: null,
        },
      ]
    )
    const tts = report.buckets.find((row) => row.id === 'tts')
    const word = report.buckets.find((row) => row.id === 'word')
    assert.ok(tts)
    assert.ok(word)
    assert.equal(tts.loggedCalls, 1)
    assert.equal(word.loggedCalls, 1)
    assert.equal(tts.savedVnd, tts.spentVnd * 3)
    assert.equal(word.savedVnd, word.spentVnd)
    assert.equal(report.hits, 4)
    assert.equal(report.misses, 2)
    assert.equal(report.hitRate, 4 / 6)
    assert.equal(report.savedVnd, tts.savedVnd + word.savedVnd)
    assert.equal(report.spentVnd, tts.spentVnd + word.spentVnd)
    assert.equal(tts.spentVnd, 15_000)
    assert.equal(word.spentVnd, 7_500)
  })

  it('stamps the cache day in Vietnam time', () => {
    assert.equal(languageCoachCacheStatDayIct(new Date('2026-11-13T10:00:00Z')), '2026-11-13')
    assert.equal(languageCoachCacheStatDayIct(new Date('2026-11-13T18:30:00Z')), '2026-11-14')
  })
})
