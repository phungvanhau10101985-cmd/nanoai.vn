import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  gptImageSizeForAspect,
  imageChargeFromForm,
  imageEngineCredit,
  ImageEngineError,
  parseGptImageQuality,
} from './image-engine'

describe('imageEngineCredit', () => {
  it('keeps each Gemini tool price and doubles nothing by itself', () => {
    assert.equal(imageEngineCredit({ geminiCost: 1.5 }), 1.5)
    assert.equal(imageEngineCredit({ engine: 'gemini', geminiCost: 3 }), 3)
    assert.equal(imageEngineCredit({ engine: null, geminiCost: 1 }), 1)
    assert.equal(imageEngineCredit({ geminiCost: 2 }), 2)
    assert.equal(imageEngineCredit({ geminiCost: 4 }), 4)
    assert.equal(imageEngineCredit({ geminiCost: 6 }), 6)
    assert.equal(imageEngineCredit({ geminiCost: 8 }), 8)
    assert.equal(imageEngineCredit({ geminiCost: 1.5, outputCount: 3 }), 4.5)
  })

  it('charges GPT 0.5 / 1 / 2 per output image and ignores the Gemini price', () => {
    assert.equal(imageEngineCredit({ engine: 'gpt', gptQuality: 'low', geminiCost: 8 }), 0.5)
    assert.equal(imageEngineCredit({ engine: 'gpt', gptQuality: 'medium', geminiCost: 4 }), 1)
    assert.equal(imageEngineCredit({ engine: 'gpt', gptQuality: 'high', geminiCost: 1.5 }), 2)
    assert.equal(imageEngineCredit({ engine: 'gpt', gptQuality: 'medium', geminiCost: 3, outputCount: 4 }), 4)
    assert.equal(imageEngineCredit({ engine: 'gpt', gptQuality: 'low', geminiCost: 3, outputCount: 2 }), 1)
  })

  it('rejects an unknown GPT quality instead of upgrading it', () => {
    assert.equal(parseGptImageQuality('low'), 'low')
    assert.equal(parseGptImageQuality('LOW'), 'low')
    assert.equal(parseGptImageQuality('auto'), null)
    assert.equal(parseGptImageQuality('4K'), null)
    assert.throws(
      () => imageEngineCredit({ engine: 'gpt', gptQuality: 'ultra', geminiCost: 1.5 }),
      ImageEngineError,
    )
  })

  it('reads the form and refuses GPT without a quality', () => {
    const gemini = imageChargeFromForm({ get: (name) => (name === 'imageQuality' ? '4K' : null) }, 1.5)
    assert.equal(gemini.engine, 'gemini')
    assert.equal(gemini.cost, 1.5)
    assert.equal(gemini.error, undefined)

    const gpt = imageChargeFromForm(
      {
        get: (name) => {
          if (name === 'imageEngine') return 'gpt'
          if (name === 'gptQuality') return 'high'
          return null
        },
      },
      8,
      2,
    )
    assert.equal(gpt.cost, 4)
    assert.equal(gpt.gptQuality, 'high')

    const missing = imageChargeFromForm({ get: (name) => (name === 'imageEngine' ? 'gpt' : null) }, 1.5)
    assert.equal(missing.engine, 'gpt')
    assert.match(missing.error || '', /low, medium hoặc high/)
  })

  it('maps aspect ratio to a GPT size and uses auto when an edit has no ratio', () => {
    assert.equal(gptImageSizeForAspect('1:1'), '1024x1024')
    assert.equal(gptImageSizeForAspect('9:16'), '1024x1536')
    assert.equal(gptImageSizeForAspect('16:9'), '1536x1024')
    assert.equal(gptImageSizeForAspect(null, true), 'auto')
    assert.equal(gptImageSizeForAspect('', false), '1024x1024')
  })
})
