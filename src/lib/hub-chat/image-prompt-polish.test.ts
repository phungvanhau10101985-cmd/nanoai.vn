import assert from 'node:assert/strict'
import test from 'node:test'

import {
  IMAGE_PROMPT_POLISH_SYSTEM,
  LOGO_PROMPT_POLISH_SYSTEM,
  MENU_LIST_POLISH_SYSTEM,
  imagePromptPolishAllowed,
  isImagePromptPolishGenerator,
  isImagePromptPolishStep,
  missingNumericTokens,
} from '@/lib/hub-chat/image-prompt-polish'

test('image polish is on every image step and not on files or music', () => {
  assert.equal(isImagePromptPolishStep('packaging_kit', 'product_label'), true)
  assert.equal(isImagePromptPolishStep('packaging_kit', 'seal_sticker'), true)
  assert.equal(isImagePromptPolishStep('packaging_kit', 'face_front'), true)
  assert.equal(isImagePromptPolishStep('packaging_kit', 'logo'), true)
  assert.equal(isImagePromptPolishStep('food_menu', 'menu_design'), true)
  assert.equal(isImagePromptPolishStep('mobile_shop', 'home_mobile'), true)
  assert.equal(isImagePromptPolishStep('packaging_kit', 'barcode_label'), false)
  assert.equal(isImagePromptPolishStep('packaging_kit', 'box_net_2d'), false)
  assert.equal(isImagePromptPolishStep('packaging_kit', 'box_dieline_pdf'), false)
  assert.equal(isImagePromptPolishStep('packaging_kit', 'brand_name'), false)
  assert.equal(isImagePromptPolishGenerator('lyria_music'), false)
  assert.equal(isImagePromptPolishGenerator('portrait'), true)
  assert.equal(isImagePromptPolishGenerator(null), false)
})

test('each image text field is allowed only on its own step', () => {
  const base = { discoveryComplete: true, pendingPreview: false }
  assert.equal(
    imagePromptPolishAllowed({
      ...base,
      presetId: 'packaging_kit',
      stepKey: 'product_label',
      target: 'composer',
    }),
    true
  )
  assert.equal(
    imagePromptPolishAllowed({
      ...base,
      presetId: 'sale_banner',
      stepKey: 'banner_design',
      target: 'banner_overlay',
    }),
    true
  )
  assert.equal(
    imagePromptPolishAllowed({
      ...base,
      presetId: 'packaging_kit',
      stepKey: 'product_label',
      target: 'banner_overlay',
    }),
    false
  )
  assert.equal(
    imagePromptPolishAllowed({
      ...base,
      presetId: 'food_menu',
      stepKey: 'menu_design',
      target: 'menu_bulk',
    }),
    true
  )
  assert.equal(
    imagePromptPolishAllowed({
      ...base,
      presetId: 'landing_page',
      stepKey: 'landing_full',
      target: 'landing_section',
    }),
    true
  )
  assert.equal(
    imagePromptPolishAllowed({
      presetId: 'landing_page',
      stepKey: 'product_name',
      discoveryComplete: false,
      pendingPreview: false,
      target: 'landing_logo',
    }),
    false
  )
  assert.equal(
    imagePromptPolishAllowed({
      ...base,
      presetId: 'landing_page',
      stepKey: 'landing_full',
      target: 'landing_logo',
    }),
    true
  )
  assert.equal(
    imagePromptPolishAllowed({
      presetId: 'packaging_kit',
      stepKey: 'product_label',
      discoveryComplete: true,
      pendingPreview: true,
      target: 'composer',
    }),
    false
  )
})

test('prices and quoted print copy must survive a rewrite', () => {
  assert.deepEqual(missingNumericTokens('Phở 65.000\nTrà 20.000', 'Phở 65.000'), ['20.000'])
  assert.deepEqual(missingNumericTokens('Dung tích 30ml', 'Dung tích 30ml'), [])
  assert.match(IMAGE_PROMPT_POLISH_SYSTEM, /character-for-character/i)
  assert.match(LOGO_PROMPT_POLISH_SYSTEM, /Never translate/i)
  assert.match(MENU_LIST_POLISH_SYSTEM, /invent items/i)
})
