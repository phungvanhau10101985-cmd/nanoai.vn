import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { documentTranslateJobPlan } from './document-translate-pricing'

describe('document translate job plan', () => {
  it('reads GPT from the credit amount stored with 2K or 4K', () => {
    assert.equal(documentTranslateJobPlan('2K', 0.5).gptQuality, 'low')
    assert.equal(documentTranslateJobPlan('2K', 1).engine, 'gpt')
    assert.equal(documentTranslateJobPlan('2K', 1).gptQuality, 'medium')
    assert.equal(documentTranslateJobPlan('4K', 2).gptQuality, 'high')
  })

  it('keeps Gemini when the credit is not a GPT price', () => {
    assert.equal(documentTranslateJobPlan('2K', 1.5).engine, 'gemini')
    assert.equal(documentTranslateJobPlan('2K', 1.5).geminiSize, '2K')
    assert.equal(documentTranslateJobPlan('2K', 3).engine, 'gemini')
    assert.equal(documentTranslateJobPlan('4K', 4).geminiSize, '4K')
    assert.equal(documentTranslateJobPlan('4K', 6).engine, 'gemini')
  })
})
