import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  WEDDING_CARD_COMPLETION_CHECKS,
  weddingCardCompletionMissingSql,
  weddingCardCompletionPercent,
  weddingCardCompletionScoreSql,
} from './wedding-card-completion'

describe('wedding card completion', () => {
  it('scores ten equal parts', () => {
    assert.equal(WEDDING_CARD_COMPLETION_CHECKS.length, 10)
    assert.equal(weddingCardCompletionPercent(0), 0)
    assert.equal(weddingCardCompletionPercent(4), 40)
    assert.equal(weddingCardCompletionPercent(6.4), 64)
    assert.equal(weddingCardCompletionPercent(10), 100)
    assert.equal(weddingCardCompletionPercent(99), 100)
  })

  it('builds score and missing SQL against the card alias', () => {
    const score = weddingCardCompletionScoreSql('c')
    const missing = weddingCardCompletionMissingSql('c')
    assert.match(score, /c\.groom_name/)
    assert.doesNotMatch(score, /card\./)
    assert.match(missing, /c\.is_published/)
    for (const check of WEDDING_CARD_COMPLETION_CHECKS) {
      assert.match(missing, new RegExp(`'${check.key}'`))
    }
  })
})
