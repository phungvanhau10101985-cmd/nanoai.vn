import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { selectLocalizationEngine } from './process-one'
import { imageLocGptVerifyAttempts, imageLocOpenaiDefaultQuality, languagePrompt, normalizeOpenaiImageQuality } from './image-localization-config'
import { chineseBlocksToRedraw, localizedImageFix, localizedImageProblem, parseInkBleedVerdict, remainingChineseOnLocalizedImage } from './gpt-verify'
import { ImageLocalizationGptStopError, isImageLocalizationGptStopError } from './openai-adapter'

describe('image localization route', () => {
  it('keeps ordinary images on the local translator when AI is off', () => {
    assert.equal(
      selectLocalizationEngine({
        classification: 'gemini',
        allowsAi: false,
        geminiMode: 'api',
        hasSizeOrLaundry: false,
      }),
      'local'
    )
    assert.equal(
      selectLocalizationEngine({
        classification: 'local',
        allowsAi: false,
        geminiMode: 'api',
        hasSizeOrLaundry: false,
      }),
      'local'
    )
  })

  it('uses the same branches as the 188 job', () => {
    assert.equal(
      selectLocalizationEngine({
        classification: 'local',
        allowsAi: false,
        geminiMode: 'api',
        hasSizeOrLaundry: true,
        apparelSheet: true,
      }),
      'ai'
    )
    assert.equal(
      selectLocalizationEngine({
        classification: 'keep',
        allowsAi: false,
        geminiMode: 'api',
        hasSizeOrLaundry: true,
        apparelSheet: true,
      }),
      'keep'
    )
    assert.equal(
      selectLocalizationEngine({
        classification: 'delete',
        allowsAi: false,
        geminiMode: 'api',
        hasSizeOrLaundry: true,
        apparelSheet: true,
      }),
      'delete'
    )
    assert.equal(
      selectLocalizationEngine({
        classification: 'gemini',
        allowsAi: false,
        geminiMode: 'openai',
        hasSizeOrLaundry: true,
      }),
      'local'
    )
    assert.equal(
      selectLocalizationEngine({
        classification: 'local',
        allowsAi: true,
        geminiMode: 'openai',
        hasSizeOrLaundry: false,
      }),
      'ai'
    )
    assert.equal(
      selectLocalizationEngine({
        classification: 'gemini',
        allowsAi: true,
        geminiMode: 'openai',
        hasSizeOrLaundry: true,
        apparelSheet: false,
      }),
      'ai'
    )
    assert.equal(
      selectLocalizationEngine({
        classification: 'local',
        allowsAi: false,
        geminiMode: 'api',
        hasSizeOrLaundry: false,
        forceAi: true,
      }),
      'local'
    )
  })

  it('tells the size-chart prompt to remove a model and the product photo and keep the measurements', () => {
    const plain = languagePrompt('vi')
    const size = languagePrompt('vi', { removeModel: true })
    assert.equal(plain.includes('erase both the model'), false)
    assert.equal(size.includes('erase both the model'), true)
    assert.equal(size.includes('product photo'), true)
    assert.equal(size.includes('Keep the size chart'), true)
    assert.equal(size.includes('keep the black filled option'), true)
    assert.equal(size.includes('Do not keep the original Chinese'), true)
    assert.equal(size.includes('Do not add a second copy of any line'), true)
    assert.equal(plain.includes('1 斤 = 0.5 kg'), true)
    assert.equal(plain.includes('94 斤 becomes 47 kg'), true)
    assert.equal(size.includes('Still convert 斤 body weight to kilograms'), true)
    assert.equal(normalizeOpenaiImageQuality('medium'), 'medium')
    assert.equal(normalizeOpenaiImageQuality('low'), 'low')
    assert.equal(imageLocOpenaiDefaultQuality(), 'medium')
  })

  it('marks a GPT image failure as a job stop', () => {
    const err = new ImageLocalizationGptStopError('OpenAI images/edits lỗi HTTP 500: boom')
    assert.equal(isImageLocalizationGptStopError(err), true)
    assert.equal(isImageLocalizationGptStopError(new Error('vẽ local lỗi')), false)
  })

  it('redraws a bleeding sheet twice, then the job stops', () => {
    assert.equal(imageLocGptVerifyAttempts(), 2)
  })

  it('accepts a GPT image only when no Chinese remains', () => {
    assert.deepEqual(remainingChineseOnLocalizedImage(['Ngực 82 cm', 'S', '']), [])
    assert.equal(localizedImageProblem({ bleed: false, chinese: [] }), '')
    const left = remainingChineseOnLocalizedImage(['胸围 82', 'Giặt tay'])
    assert.deepEqual(left, ['胸围 82'])
    assert.equal(localizedImageProblem({ bleed: false, chinese: ['胸围 82', '洗涤说明'] }).includes('胸围'), true)
  })

  it('redraws ink bleed with GPT and leftover Chinese with DeepSeek', () => {
    assert.equal(localizedImageFix({ bleed: true, chineseCount: 2 }), 'gpt')
    assert.equal(localizedImageFix({ bleed: false, chineseCount: 1 }), 'deepseek')
    assert.equal(localizedImageFix({ bleed: false, chineseCount: 0 }), 'ok')
    assert.equal(parseInkBleedVerdict('{"bleed":true,"where":"size table"}')?.bleed, true)
    assert.equal(parseInkBleedVerdict('{"bleed":false,"where":""}')?.bleed, false)
    assert.equal(parseInkBleedVerdict('not json'), null)
    assert.deepEqual(
      chineseBlocksToRedraw([
        { text: '胸围', bbox: [0, 0, 10, 10] },
        { text: '82 cm', bbox: [12, 0, 30, 10] },
      ]).map((block) => block.text),
      ['胸围']
    )
    assert.equal(localizedImageProblem({ bleed: true, where: 'bảng size', chinese: ['胸围'] }).includes('mực loang'), true)
  })
})
