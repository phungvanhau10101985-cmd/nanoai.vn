import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  NANOAI_GEMINI_ASPECT_MODELS,
  NANOAI_GPT_ASPECT_MODELS,
  NANOAI_IMAGE_NAME,
  publicGeminiImageName,
  publicGptImageName,
} from './nanoai-image-names'

describe('public image tier names', () => {
  it('uses the compact NanoAI 2 names in sell order', () => {
    assert.deepEqual(
      [publicGptImageName('medium'), publicGptImageName('high'), publicGeminiImageName('2K'), publicGeminiImageName('4K')],
      ['NanoAI 2M', 'NanoAI 2H', 'NanoAI 2K', 'NanoAI 4K'],
    )
    assert.equal(publicGptImageName('low'), NANOAI_IMAGE_NAME.low)
    assert.equal(NANOAI_IMAGE_NAME.low, 'NanoAI 2L')
    assert.equal(NANOAI_GEMINI_ASPECT_MODELS, 'NanoAI 2K / NanoAI 4K')
    assert.equal(NANOAI_GPT_ASPECT_MODELS, 'NanoAI 2L / NanoAI 2M / NanoAI 2H')
  })
})
