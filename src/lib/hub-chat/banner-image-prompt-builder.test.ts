import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBannerImageGenerationPrompt } from './banner-image-prompt-builder'

test('buildBannerImageGenerationPrompt — ghép trực tiếp không qua Gemini', () => {
  const result = buildBannerImageGenerationPrompt({
    locale: 'vi',
    briefNotes: {
      campaign_name: 'Sale hè',
      product_offer: 'Giảm 50% giày thể thao',
      discount_cta: 'MUA NGAY',
      domain_name: '188.com.vn',
      brand_style: 'năng động',
      color_tone: 'tím gradient',
    },
    overlayText: 'Sản phẩm bên phải, logo góc trên trái',
    presetId: 'horizontal_display_ads',
    aspectRatio: '16:9',
    adChannelLabel: 'Google Display',
    platformHint: 'Wide horizontal banner',
    hasReferenceImages: true,
    hasLogo: true,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.ok(result.prompt.includes('Sale hè'))
  assert.ok(result.prompt.includes('Giảm 50%'))
  assert.ok(result.prompt.includes('Sản phẩm bên phải'))
  assert.ok(result.prompt.includes('brand_style'))
  assert.ok(result.prompt.includes('LOGO image will be attached'))
  assert.ok(!result.prompt.includes('---IMAGE_PROMPT---'))
  assert.equal(result.structuredCopy, 'Sản phẩm bên phải, logo góc trên trái')
})

test('buildBannerImageGenerationPrompt — chỉ brief discovery', () => {
  const result = buildBannerImageGenerationPrompt({
    locale: 'vi',
    briefNotes: {
      product_offer: 'Giảm 30%',
      discount_cta: 'SHOP NOW',
    },
    presetId: 'square_social_ads',
    aspectRatio: '1:1',
    adChannelLabel: 'Facebook Feed',
    platformHint: 'Square social',
    hasReferenceImages: false,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.ok(result.prompt.includes('Giảm 30%'))
  assert.ok(result.prompt.includes('product_offer'))
})

test('buildBannerImageGenerationPrompt — rỗng', () => {
  assert.deepEqual(
    buildBannerImageGenerationPrompt({
      locale: 'vi',
      briefNotes: {},
      presetId: 'horizontal_display_ads',
      aspectRatio: '16:9',
      adChannelLabel: 'Google Display',
      platformHint: 'Wide',
      hasReferenceImages: false,
    }),
    { ok: false, error: 'EMPTY_BRIEF' }
  )
})
