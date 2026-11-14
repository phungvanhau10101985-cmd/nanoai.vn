import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildTranslatePrompt } from './document-translate-prompt'

describe('buildTranslatePrompt', () => {
  const prompt = buildTranslatePrompt('ar', null, 'vi')

  it('names the source and the target', () => {
    assert.match(prompt, /SOURCE: Arabic/)
    assert.match(prompt, /TARGET: Vietnamese/)
  })

  it('keeps paint on the product, logos, and phone numbers, and translates a poster badge', () => {
    assert.match(prompt, /physically printed, painted, or stuck on the product/)
    assert.match(prompt, /not on the product/)
    assert.match(prompt, /phone number/)
    assert.match(prompt, /Yunnei 490 tăng áp/)
    assert.match(prompt, /cubic meters/)
    assert.match(prompt, /split type/)
  })

  it('adds keep-terms and a text layer only when asked', () => {
    const plain = buildTranslatePrompt('zh', null, 'vi')
    assert.doesNotMatch(plain, /KEEP these strings exactly/)
    assert.doesNotMatch(plain, /"lines"/)
    const extra = buildTranslatePrompt('zh', null, 'vi', { keepTerms: ['VTC-15', 'kW'], captureLines: true })
    assert.match(extra, /"VTC-15"/)
    assert.match(extra, /"kW"/)
    assert.match(extra, /\{"lines":/)
  })

  it('translates the introduction, the specification, the usage line, and the contact line', () => {
    assert.match(prompt, /product introduction or a sales line/)
    assert.match(prompt, /specification label/)
    assert.match(prompt, /words that explain a specification/)
    assert.match(prompt, /condition, maintenance, or how to use/)
    assert.match(prompt, /contact invitation/)
    assert.match(prompt, /Do not add a claim/)
    assert.match(prompt, /same languages/)
  })
})
