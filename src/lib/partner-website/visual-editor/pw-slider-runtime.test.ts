import assert from 'node:assert/strict'
import test from 'node:test'
import { buildVisualEditorScript } from '@/lib/partner-website/visual-editor/build-visual-editor-script'
import {
  clampPwSliderWait,
  PARTNER_SHOP_SLIDER_CSS,
  PW_SLIDER_FULL_ATTR,
  PW_SLIDER_WAIT_DEFAULT,
  shouldMergeBannerAsSlide,
} from '@/lib/partner-website/visual-editor/pw-slider-runtime'

test('clamps slide wait to 0–12s', () => {
  assert.equal(clampPwSliderWait(undefined), PW_SLIDER_WAIT_DEFAULT)
  assert.equal(clampPwSliderWait(-10), 0)
  assert.equal(clampPwSliderWait(4000), 4000)
  assert.equal(clampPwSliderWait(99999), 12000)
})

test('slider CSS uses theme tokens and edge arrows', () => {
  assert.match(PARTNER_SHOP_SLIDER_CSS, /data-pw-slider/)
  assert.match(PARTNER_SHOP_SLIDER_CSS, /pw-slide-prev/)
  assert.match(PARTNER_SHOP_SLIDER_CSS, /pw-slide-next/)
  assert.match(PARTNER_SHOP_SLIDER_CSS, /flex:0 0 100%/)
  assert.match(PARTNER_SHOP_SLIDER_CSS, /var\(--pw-primary\)/)
  assert.match(PARTNER_SHOP_SLIDER_CSS, new RegExp(PW_SLIDER_FULL_ATTR))
  assert.doesNotMatch(PARTNER_SHOP_SLIDER_CSS, /#f97316|#ea580c/)
})

test('merges sliding banner only beside an existing banner', () => {
  assert.equal(shouldMergeBannerAsSlide({ mergeSlide: true, place: 'right', neighborIsBanner: true }), true)
  assert.equal(shouldMergeBannerAsSlide({ mergeSlide: true, place: 'left', neighborIsBanner: true }), true)
  assert.equal(shouldMergeBannerAsSlide({ mergeSlide: true, place: 'after', neighborIsBanner: true }), false)
  assert.equal(shouldMergeBannerAsSlide({ mergeSlide: true, place: 'right', neighborIsBanner: false }), false)
  assert.equal(shouldMergeBannerAsSlide({ mergeSlide: false, place: 'right', neighborIsBanner: true }), false)
})

test('editor script boots slider and accepts wait/arrow messages', () => {
  const s = buildVisualEditorScript('vi')
  assert.match(s, /setSlideWait/)
  assert.match(s, /setSlideArrows/)
  assert.match(s, /pwSliderBoot/)
  assert.match(s, /data-pw-slide-wait/)
  assert.match(s, /setInsertHAnchor/)
  assert.match(s, /insertBeside/)
  assert.match(s, /data-pw-hrow/)
  assert.match(s, /tryMergeBannerSlide/)
  assert.match(s, /convertHeroToFullSlider/)
  assert.match(s, /data-pw-full-slides/)
  assert.match(s, /pwSliderPromoteFull/)
  assert.match(s, /translate3d/)
  assert.doesNotThrow(() => {
    // eslint-disable-next-line no-new-func
    new Function(s)
  })
})

test('editor hover shows element name and stays out of saved HTML', () => {
  const s = buildVisualEditorScript('vi')
  assert.match(s, /function hoverNameOf/)
  assert.match(s, /nanoai-ve-hover-name/)
  assert.match(s, /d\.type === 'setHoverNameOn'/)
  assert.match(s, /"banner":"Banner"/)
  assert.match(s, /"cat-toggle":"Danh mục"/)
})
