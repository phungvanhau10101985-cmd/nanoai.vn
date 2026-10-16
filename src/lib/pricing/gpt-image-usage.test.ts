import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { USD_TO_VND, calcCostVnd } from './api-token-cost'
import { billGptImageUsage, gptImageFallbackOutputUsd } from './gpt-image-usage'

describe('gpt image api cost', () => {
  it('maps published output prices onto ledger tokens', () => {
    const cases = [
      { quality: 'low' as const, size: '1024x1024', usd: 0.006 },
      { quality: 'medium' as const, size: '1024x1024', usd: 0.05301 },
      { quality: 'high' as const, size: '1024x1024', usd: 0.21099 },
      { quality: 'low' as const, size: '1024x1536', usd: 0.00501 },
      { quality: 'medium' as const, size: '1536x1024', usd: 0.04101 },
      { quality: 'high' as const, size: '1536x1024', usd: 0.165 },
    ]
    for (const row of cases) {
      const usd = gptImageFallbackOutputUsd(row.quality, row.size)
      assert.ok(Math.abs(usd - row.usd) < 0.00002, `${row.quality} ${row.size} got ${usd}`)
      const billed = billGptImageUsage({ quality: row.quality, size: row.size, prompt: '' })
      const vnd = calcCostVnd(0, billed.candidatesTokenCount, 'gpt-image-2', billed.logImageSize, USD_TO_VND)
      assert.equal(vnd, Math.round(usd * USD_TO_VND))
    }
  })

  it('scales fallback tokens for a custom tall size', () => {
    const usd = gptImageFallbackOutputUsd('low', '1104x3312')
    const expected = (697 / 1_000_000) * 30
    assert.ok(Math.abs(usd - expected) < 0.00002, `got ${usd}`)
  })

  it('keeps GPT output tokens when a 2K size is passed', () => {
    const billed = billGptImageUsage({ quality: 'low', size: '1024x1024', prompt: '' })
    const withTier = calcCostVnd(0, billed.candidatesTokenCount, 'gpt-image-2', '2K', USD_TO_VND)
    const withQuality = calcCostVnd(0, billed.candidatesTokenCount, 'gpt-image-2', billed.logImageSize, USD_TO_VND)
    assert.equal(withTier, withQuality)
    assert.equal(withQuality, Math.round(0.006 * USD_TO_VND))
    const gemini2k = calcCostVnd(0, 1120, 'gemini-3-pro-image', '2K', USD_TO_VND)
    assert.notEqual(withQuality, gemini2k)
  })

  it('converts image input tokens so the $5 input rate equals $8', () => {
    const billed = billGptImageUsage({
      quality: 'medium',
      size: 'auto',
      prompt: 'ignored',
      usage: { input_tokens_details: { text_tokens: 10, image_tokens: 5 }, output_tokens: 100 },
    })
    assert.equal(billed.promptTokenCount, 18)
    assert.equal(billed.candidatesTokenCount, 100)
    assert.equal(billed.logImageSize, 'gpt-medium')
    const inputVnd = calcCostVnd(billed.promptTokenCount, 0, 'gpt-image-2', billed.logImageSize, USD_TO_VND)
    const directUsd = (10 / 1_000_000) * 5 + (5 / 1_000_000) * 8
    assert.equal(inputVnd, Math.round(directUsd * USD_TO_VND))
  })
})
